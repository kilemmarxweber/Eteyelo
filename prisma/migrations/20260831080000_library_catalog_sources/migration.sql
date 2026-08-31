-- AlterEnum
ALTER TYPE "LibrarySource" ADD VALUE IF NOT EXISTS 'GOOGLE_DRIVE';

-- CreateEnum
CREATE TYPE "LibraryCatalogSourceKind" AS ENUM ('GOOGLE_DRIVE');

-- CreateTable
CREATE TABLE "LibraryCatalogSource" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "kind" "LibraryCatalogSourceKind" NOT NULL DEFAULT 'GOOGLE_DRIVE',
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "folderId" TEXT,
    "apiKey" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryCatalogSource_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LibraryBook" ADD COLUMN "catalogSourceId" TEXT;
ALTER TABLE "LibraryBook" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE INDEX "LibraryCatalogSource_branchId_isEnabled_idx" ON "LibraryCatalogSource"("branchId", "isEnabled");

-- CreateIndex
CREATE INDEX "LibraryCatalogSource_branchId_kind_idx" ON "LibraryCatalogSource"("branchId", "kind");

-- CreateIndex
CREATE INDEX "LibraryBook_catalogSourceId_idx" ON "LibraryBook"("catalogSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryBook_catalogSourceId_externalId_key" ON "LibraryBook"("catalogSourceId", "externalId");

-- AddForeignKey
ALTER TABLE "LibraryCatalogSource" ADD CONSTRAINT "LibraryCatalogSource_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryBook" ADD CONSTRAINT "LibraryBook_catalogSourceId_fkey" FOREIGN KEY ("catalogSourceId") REFERENCES "LibraryCatalogSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
