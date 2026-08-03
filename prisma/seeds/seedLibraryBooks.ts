import "dotenv/config";
import fs from "fs/promises";
import path from "path";

import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import {
  MAX_LIBRARY_BOOK_BYTES,
  uploadLibraryBuffer,
} from "@/lib/library/storage";
import { getLibrarySeedCyclesForBranch } from "@/lib/library/taxonomy";
import { prisma } from "@/lib/prisma";
import {
  LibraryCycle,
  LibraryFileType,
  LibrarySource,
  LibraryVisibility,
} from "@/prisma/generated/prisma/enums";

type CatalogEntry = {
  slug: string;
  title: string;
  author: string;
  publisher: string;
  description: string;
  cycle: "PRIMAIRE" | "SECONDAIRE" | "HUMANITES" | "FORMATION" | "UNIVERSITE";
  level: string;
  subject: string;
  section: string;
  category: string;
  language: string;
  license: string;
  tags: string[];
  gutenbergId?: number;
  coverUrl?: string;
};

const CACHE_DIR = path.join(process.cwd(), ".data", "library-seed-cache");

/** PDF minimal 1 page — uniquement si LIBRARY_SEED_INCLUDE_STUBS=1 */
function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildOpenLicensePdf(entry: CatalogEntry): Buffer {
  const lines = [
    entry.title,
    "",
    `Auteur : ${entry.author}`,
    `Licence : ${entry.license}`,
    `Cycle : ${entry.cycle} — ${entry.level}`,
    `Matiere : ${entry.subject}`,
    "",
    "Contenu pedagogique ouvert (CC0) pour la bibliotheque Kalasa.",
    "Ce fichier n'est PAS un manuel commercial EPST.",
    "Il sert a demontrer le catalogue RDC (primaire -> humanites).",
    "",
    entry.description.slice(0, 280),
  ];

  const contentLines = lines
    .map((line, index) => {
      const y = 720 - index * 22;
      return `BT /F1 12 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
    })
    .join("\n");

  const stream = contentLines;
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

async function readJsonCatalog(fileName: string): Promise<CatalogEntry[]> {
  const filePath = path.join(process.cwd(), "prisma", "seeds", fileName);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as CatalogEntry[];
  } catch {
    return [];
  }
}

async function loadCatalog(): Promise<CatalogEntry[]> {
  const includeStubs = process.env.LIBRARY_SEED_INCLUDE_STUBS === "1";
  const [rdc, gutenberg] = await Promise.all([
    includeStubs ? readJsonCatalog("library-rdc-open.json") : Promise.resolve([]),
    readJsonCatalog("library-gutenberg-open.json"),
  ]);
  const bySlug = new Map<string, CatalogEntry>();
  for (const entry of [...rdc, ...gutenberg]) {
    bySlug.set(entry.slug, entry);
  }
  return [...bySlug.values()];
}

async function resolveBookFile(entry: CatalogEntry): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  fileType: LibraryFileType;
} | null> {
  if (entry.gutenbergId) {
    const epubPath = path.join(CACHE_DIR, `${entry.gutenbergId}.epub`);
    try {
      const buffer = await fs.readFile(epubPath);
      if (buffer.length > MAX_LIBRARY_BOOK_BYTES) {
        console.warn(
          `    ⏭ ${entry.title} — EPUB trop volumineux (${(buffer.length / 1024 / 1024).toFixed(1)} Mo > 50 Mo)`,
        );
        return null;
      }
      if (buffer.length > 1000) {
        return {
          buffer,
          fileName: `${entry.slug}.epub`,
          mimeType: "application/epub+zip",
          fileType: LibraryFileType.EPUB,
        };
      }
    } catch {
      console.warn(`    ⏭ ${entry.title} — EPUB manquant en cache`);
      return null;
    }
  }

  // Stubs PDF 1 page : uniquement si demandé explicitement
  if (process.env.LIBRARY_SEED_INCLUDE_STUBS === "1") {
    return {
      buffer: buildOpenLicensePdf(entry),
      fileName: `${entry.slug}.pdf`,
      mimeType: "application/pdf",
      fileType: LibraryFileType.PDF,
    };
  }

  return null;
}

/** Masque les anciens PDF démo « Kalasa Open Curriculum » (contenu 1 page). */
async function deactivateStubBooks(branchIds: string[]) {
  if (branchIds.length === 0) return 0;

  const result = await prisma.libraryBook.updateMany({
    where: {
      branchId: { in: branchIds },
      source: LibrarySource.OPEN_LICENSE,
      OR: [
        { author: "Kalasa Open Curriculum" },
        { tags: { has: "rdc" }, fileType: LibraryFileType.PDF },
      ],
    },
    data: { isActive: false },
  });

  if (result.count > 0) {
    console.log(
      `  ${result.count} stub(s) PDF démo désactivé(s) (contenu limité).`,
    );
  }
  return result.count;
}

/**
 * Seed le catalogue bibliothèque (Gutenberg domaine public — vrais EPUB).
 *
 * Env optionnels :
 * - LIBRARY_SEED_BRANCH_ID : une seule branche
 * - LIBRARY_SEED_MAX_BRANCHES : limite (défaut 10)
 * - LIBRARY_SEED_INCLUDE_STUBS=1 : inclure aussi les PDF démo RDC (1 page)
 *
 * Prérequis Gutenberg : `pnpm library:fetch`
 */
export async function seedLibraryBooks() {
  console.log("Initialisation catalogue bibliothèque (Gutenberg EPUB)…");

  const catalog = await loadCatalog();
  console.log(`  Catalogue chargé : ${catalog.length} titre(s)`);

  if (catalog.length === 0) {
    console.warn(
      "Catalogue vide. Lancez d’abord : pnpm library:fetch",
    );
    return { branches: 0, created: 0, skipped: 0 };
  }

  const branchFilterId = process.env.LIBRARY_SEED_BRANCH_ID?.trim();
  const maxBranches = Number(process.env.LIBRARY_SEED_MAX_BRANCHES || 10);

  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
      ...(branchFilterId ? { id: branchFilterId } : {}),
    },
    select: { id: true, name: true, typebranch: true },
    orderBy: { createdAt: "asc" },
    take: branchFilterId ? 1 : maxBranches,
  });

  if (branches.length === 0) {
    console.warn(
      "Aucune branche active — catalogue non seedé. Créez une école puis relancez.",
    );
    return { branches: 0, created: 0, skipped: 0 };
  }

  await deactivateStubBooks(branches.map((b) => b.id));

  let created = 0;
  let skipped = 0;

  for (const branch of branches) {
    const allowedCycles = new Set(getLibrarySeedCyclesForBranch(branch.typebranch));
    const branchCatalog = catalog.filter((entry) =>
      allowedCycles.has(entry.cycle),
    );

    console.log(
      `  Branche : ${branch.name} (${branch.typebranch}) — ${branchCatalog.length} titre(s)`,
    );

    for (const [index, entry] of branchCatalog.entries()) {
      const existing = await prisma.libraryBook.findFirst({
        where: {
          branchId: branch.id,
          source: LibrarySource.OPEN_LICENSE,
          tags: { has: entry.slug },
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.libraryBook.update({
          where: { id: existing.id },
          data: {
            title: entry.title,
            author: entry.author,
            publisher: entry.publisher,
            description: entry.description,
            license: entry.license,
            coverImage: entry.coverUrl || KLAMBOCORE_DEFAULT_IMAGE_PATH,
            cycle: entry.cycle as LibraryCycle,
            level: entry.level,
            section: entry.section,
            subject: entry.subject,
            isActive: true,
          },
        });
        skipped += 1;
        continue;
      }

      const file = await resolveBookFile(entry);
      if (!file) continue;

      const saved = await uploadLibraryBuffer({
        buffer: file.buffer,
        fileName: file.fileName,
        branchId: branch.id,
        mimeType: file.mimeType,
      });

      await prisma.libraryBook.create({
        data: {
          title: entry.title,
          author: entry.author,
          publisher: entry.publisher,
          description: entry.description,
          coverImage: entry.coverUrl || KLAMBOCORE_DEFAULT_IMAGE_PATH,
          fileUrl: saved.storageKey,
          fileType: file.fileType,
          fileSize: saved.fileSize,
          language: entry.language || "fr",
          license: entry.license,
          cycle: entry.cycle as LibraryCycle,
          level: entry.level,
          section: entry.section,
          subject: entry.subject,
          category: entry.category,
          tags: [...entry.tags, entry.slug],
          visibility: LibraryVisibility.STUDENTS,
          allowDownload: false,
          isActive: true,
          source: LibrarySource.OPEN_LICENSE,
          sortOrder: index,
          branchId: branch.id,
        },
      });

      created += 1;
      if (created % 25 === 0) {
        console.log(`    … ${created} créés`);
      }
    }

    console.log(
      `    → créés cumulés: ${created}, ignorés/mis à jour: ${skipped}`,
    );
  }

  console.log(
    `Catalogue prêt: ${branches.length} branche(s), ${created} livre(s) créés, ${skipped} déjà présents.`,
  );
  return { branches: branches.length, created, skipped };
}

export async function clearLibraryBooksSeed() {
  console.log("Suppression des livres seed OPEN_LICENSE...");

  const books = await prisma.libraryBook.findMany({
    where: { source: LibrarySource.OPEN_LICENSE },
    select: { id: true, fileUrl: true },
  });

  const { deleteLibraryFile } = await import("@/lib/library/storage");

  for (const book of books) {
    await deleteLibraryFile(book.fileUrl);
  }

  const result = await prisma.libraryBook.deleteMany({
    where: { source: LibrarySource.OPEN_LICENSE },
  });

  console.log(`  ${result.count} livre(s) OPEN_LICENSE supprimés.`);
  return result.count;
}
