import "dotenv/config";
import fs from "fs/promises";
import path from "path";

import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { uploadLibraryBuffer } from "@/lib/library/storage";
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
  cycle: "PRIMAIRE" | "SECONDAIRE" | "HUMANITES";
  level: string;
  subject: string;
  section: string;
  category: string;
  language: string;
  license: string;
  tags: string[];
};

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** PDF minimal 1 page (contenu libre CC0) — sans dépendance externe. */
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

async function loadCatalog(): Promise<CatalogEntry[]> {
  const filePath = path.join(
    process.cwd(),
    "prisma",
    "seeds",
    "library-rdc-open.json",
  );
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as CatalogEntry[];
}

/**
 * Seed le catalogue RDC open-license sur les branches actives.
 *
 * Env optionnels :
 * - LIBRARY_SEED_BRANCH_ID : une seule branche
 * - LIBRARY_SEED_MAX_BRANCHES : limite (défaut 10)
 */
export async function seedLibraryBooks() {
  console.log("Initialisation catalogue bibliothèque RDC (open-license)...");

  const catalog = await loadCatalog();
  const branchFilterId = process.env.LIBRARY_SEED_BRANCH_ID?.trim();
  const maxBranches = Number(process.env.LIBRARY_SEED_MAX_BRANCHES || 10);

  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
      ...(branchFilterId ? { id: branchFilterId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
    take: branchFilterId ? 1 : maxBranches,
  });

  if (branches.length === 0) {
    console.warn(
      "Aucune branche active — catalogue non seedé. Créez une école puis relancez.",
    );
    return { branches: 0, created: 0, skipped: 0 };
  }

  let created = 0;
  let skipped = 0;

  for (const branch of branches) {
    console.log(`  Branche : ${branch.name}`);

    for (const [index, entry] of catalog.entries()) {
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
          },
        });
        skipped += 1;
        continue;
      }

      const pdf = buildOpenLicensePdf(entry);
      const saved = await uploadLibraryBuffer({
        buffer: pdf,
        fileName: `${entry.slug}.pdf`,
        branchId: branch.id,
        mimeType: "application/pdf",
      });

      await prisma.libraryBook.create({
        data: {
          title: entry.title,
          author: entry.author,
          publisher: entry.publisher,
          description: entry.description,
          coverImage: KLAMBOCORE_DEFAULT_IMAGE_PATH,
          fileUrl: saved.storageKey,
          fileType: LibraryFileType.PDF,
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
    }

    console.log(
      `    → ${catalog.length} titres catalogue (créés cumulés: ${created}, ignorés: ${skipped})`,
    );
  }

  console.log(
    `Catalogue RDC prêt: ${branches.length} branche(s), ${created} livre(s) créés, ${skipped} déjà présents.`,
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
