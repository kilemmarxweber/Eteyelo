-- CreateEnum
CREATE TYPE "LibraryCycle" AS ENUM ('PRIMAIRE', 'SECONDAIRE', 'HUMANITES');

-- CreateEnum
CREATE TYPE "LibraryFileType" AS ENUM ('PDF', 'EPUB');

-- CreateEnum
CREATE TYPE "LibraryVisibility" AS ENUM ('STUDENTS');

-- CreateEnum
CREATE TYPE "LibrarySource" AS ENUM ('SCHOOL_UPLOAD', 'OPEN_LICENSE', 'PLATFORM_CATALOG');

-- CreateTable
CREATE TABLE "LibraryBook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "description" TEXT,
    "coverImage" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileType" "LibraryFileType" NOT NULL,
    "fileSize" INTEGER,
    "pageCount" INTEGER,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "license" TEXT,
    "isbn" TEXT,
    "cycle" "LibraryCycle",
    "level" TEXT,
    "section" TEXT,
    "subject" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'STUDENTS',
    "allowDownload" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "LibrarySource" NOT NULL DEFAULT 'SCHOOL_UPLOAD',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "LibraryBook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryBook_branchId_idx" ON "LibraryBook"("branchId");

-- CreateIndex
CREATE INDEX "LibraryBook_branchId_isActive_idx" ON "LibraryBook"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "LibraryBook_cycle_idx" ON "LibraryBook"("cycle");

-- CreateIndex
CREATE INDEX "LibraryBook_level_idx" ON "LibraryBook"("level");

-- CreateIndex
CREATE INDEX "LibraryBook_subject_idx" ON "LibraryBook"("subject");

-- CreateIndex
CREATE INDEX "LibraryBook_category_idx" ON "LibraryBook"("category");

-- CreateIndex
CREATE INDEX "LibraryBook_visibility_idx" ON "LibraryBook"("visibility");

-- CreateIndex
CREATE INDEX "LibraryBook_fileType_idx" ON "LibraryBook"("fileType");

-- AddForeignKey
ALTER TABLE "LibraryBook" ADD CONSTRAINT "LibraryBook_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
