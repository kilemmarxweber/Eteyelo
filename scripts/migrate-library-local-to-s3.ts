/**
 * Migre les fichiers bibliothèque du stockage local vers S3 (R2 / Supabase / AWS).
 *
 * Prérequis :
 *   LIBRARY_STORAGE_DRIVER=s3
 *   LIBRARY_S3_BUCKET=...
 *   LIBRARY_S3_ACCESS_KEY_ID=...
 *   LIBRARY_S3_SECRET_ACCESS_KEY=...
 *   LIBRARY_S3_ENDPOINT=...   (R2 / Supabase)
 *   LIBRARY_S3_FORCE_PATH_STYLE=true  (souvent requis Supabase)
 *
 * Usage :
 *   pnpm exec tsx scripts/migrate-library-local-to-s3.ts
 *   pnpm exec tsx scripts/migrate-library-local-to-s3.ts --dry-run
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";

import {
  getLibraryBooksRoot,
  getLibraryStorageDriver,
  resolveLibraryAbsolutePath,
  uploadLibraryBuffer,
} from "@/lib/library/storage";
import { prisma } from "@/lib/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (getLibraryStorageDriver() !== "s3") {
    console.error(
      "LIBRARY_STORAGE_DRIVER doit être `s3` avec credentials valides.",
    );
    process.exitCode = 1;
    return;
  }

  const books = await prisma.libraryBook.findMany({
    select: { id: true, title: true, fileUrl: true, fileType: true, branchId: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Livres à migrer : ${books.length}${dryRun ? " (dry-run)" : ""}`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of books) {
    // Déjà une clé relative locale typique branchId/...
    const localPath = resolveLibraryAbsolutePath(book.fileUrl);
    try {
      await fs.access(localPath);
    } catch {
      console.log(`  skip (pas de fichier local) : ${book.title}`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  would migrate : ${book.title} → ${book.fileUrl}`);
      migrated += 1;
      continue;
    }

    try {
      const buffer = await fs.readFile(localPath);
      const mimeType =
        book.fileType === "EPUB" ? "application/epub+zip" : "application/pdf";
      const saved = await uploadLibraryBuffer({
        buffer,
        fileName: path.basename(book.fileUrl),
        branchId: book.branchId,
        mimeType,
      });

      await prisma.libraryBook.update({
        where: { id: book.id },
        data: {
          fileUrl: saved.storageKey,
          fileSize: saved.fileSize,
        },
      });

      console.log(`  OK ${book.title}`);
      migrated += 1;
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${book.title}`, error);
    }
  }

  console.log(
    `\nTerminé. root local=${getLibraryBooksRoot()} | migrés=${migrated} skip=${skipped} fail=${failed}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
