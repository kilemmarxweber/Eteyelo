-- AlterTable Classe
ALTER TABLE "Classe" ADD COLUMN IF NOT EXISTS "sourceClasseId" TEXT;
ALTER TABLE "Classe" ADD COLUMN IF NOT EXISTS "practicalDomainId" TEXT;

-- AlterTable Cours
ALTER TABLE "Cours" ADD COLUMN IF NOT EXISTS "hasPracticalLab" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable PracticalDomain
CREATE TABLE IF NOT EXISTS "PracticalDomain" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticalDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable Room
CREATE TABLE IF NOT EXISTS "Room" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "practicalDomainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable PracticalDomainCours
CREATE TABLE IF NOT EXISTS "PracticalDomainCours" (
    "id" TEXT NOT NULL,
    "practicalDomainId" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "sortOrderDefault" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticalDomainCours_pkey" PRIMARY KEY ("id")
);

-- CreateTable RotationSlot
CREATE TABLE IF NOT EXISTS "RotationSlot" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "day" "Day" NOT NULL,
    "hour" TIME NOT NULL,
    "practicalDomainId" TEXT NOT NULL,
    "roomId" TEXT,
    "teacherId" TEXT,
    "anchorDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotationSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable RotationSlotItem
CREATE TABLE IF NOT EXISTS "RotationSlotItem" (
    "id" TEXT NOT NULL,
    "rotationSlotId" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotationSlotItem_pkey" PRIMARY KEY ("id")
);

-- Indexes Classe
CREATE UNIQUE INDEX IF NOT EXISTS "Classe_branchId_sourceClasseId_key" ON "Classe"("branchId", "sourceClasseId");
CREATE INDEX IF NOT EXISTS "Classe_sourceClasseId_idx" ON "Classe"("sourceClasseId");
CREATE INDEX IF NOT EXISTS "Classe_practicalDomainId_idx" ON "Classe"("practicalDomainId");

-- Indexes Cours
CREATE INDEX IF NOT EXISTS "Cours_branchId_hasPracticalLab_idx" ON "Cours"("branchId", "hasPracticalLab");

-- Indexes PracticalDomain
CREATE UNIQUE INDEX IF NOT EXISTS "PracticalDomain_branchId_code_key" ON "PracticalDomain"("branchId", "code");
CREATE INDEX IF NOT EXISTS "PracticalDomain_branchId_sortOrder_idx" ON "PracticalDomain"("branchId", "sortOrder");

-- Indexes Room
CREATE UNIQUE INDEX IF NOT EXISTS "Room_branchId_name_key" ON "Room"("branchId", "name");
CREATE INDEX IF NOT EXISTS "Room_branchId_idx" ON "Room"("branchId");
CREATE INDEX IF NOT EXISTS "Room_practicalDomainId_idx" ON "Room"("practicalDomainId");

-- Indexes PracticalDomainCours
CREATE UNIQUE INDEX IF NOT EXISTS "PracticalDomainCours_practicalDomainId_coursId_key" ON "PracticalDomainCours"("practicalDomainId", "coursId");
CREATE INDEX IF NOT EXISTS "PracticalDomainCours_coursId_idx" ON "PracticalDomainCours"("coursId");
CREATE INDEX IF NOT EXISTS "PracticalDomainCours_practicalDomainId_sortOrderDefault_idx" ON "PracticalDomainCours"("practicalDomainId", "sortOrderDefault");

-- Indexes RotationSlot
CREATE UNIQUE INDEX IF NOT EXISTS "RotationSlot_classeId_day_hour_key" ON "RotationSlot"("classeId", "day", "hour");
CREATE INDEX IF NOT EXISTS "RotationSlot_branchId_idx" ON "RotationSlot"("branchId");
CREATE INDEX IF NOT EXISTS "RotationSlot_classeId_idx" ON "RotationSlot"("classeId");
CREATE INDEX IF NOT EXISTS "RotationSlot_practicalDomainId_idx" ON "RotationSlot"("practicalDomainId");
CREATE INDEX IF NOT EXISTS "RotationSlot_roomId_day_hour_idx" ON "RotationSlot"("roomId", "day", "hour");
CREATE INDEX IF NOT EXISTS "RotationSlot_teacherId_idx" ON "RotationSlot"("teacherId");

-- Indexes RotationSlotItem
CREATE UNIQUE INDEX IF NOT EXISTS "RotationSlotItem_rotationSlotId_sortOrder_key" ON "RotationSlotItem"("rotationSlotId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "RotationSlotItem_rotationSlotId_coursId_key" ON "RotationSlotItem"("rotationSlotId", "coursId");
CREATE INDEX IF NOT EXISTS "RotationSlotItem_coursId_idx" ON "RotationSlotItem"("coursId");
CREATE INDEX IF NOT EXISTS "RotationSlotItem_teacherId_idx" ON "RotationSlotItem"("teacherId");

-- ForeignKeys (idempotent via DO blocks)
DO $$ BEGIN
  ALTER TABLE "Classe" ADD CONSTRAINT "Classe_sourceClasseId_fkey" FOREIGN KEY ("sourceClasseId") REFERENCES "Classe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Classe" ADD CONSTRAINT "Classe_practicalDomainId_fkey" FOREIGN KEY ("practicalDomainId") REFERENCES "PracticalDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PracticalDomain" ADD CONSTRAINT "PracticalDomain_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Room" ADD CONSTRAINT "Room_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Room" ADD CONSTRAINT "Room_practicalDomainId_fkey" FOREIGN KEY ("practicalDomainId") REFERENCES "PracticalDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PracticalDomainCours" ADD CONSTRAINT "PracticalDomainCours_practicalDomainId_fkey" FOREIGN KEY ("practicalDomainId") REFERENCES "PracticalDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PracticalDomainCours" ADD CONSTRAINT "PracticalDomainCours_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RotationSlot" ADD CONSTRAINT "RotationSlot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RotationSlot" ADD CONSTRAINT "RotationSlot_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RotationSlot" ADD CONSTRAINT "RotationSlot_practicalDomainId_fkey" FOREIGN KEY ("practicalDomainId") REFERENCES "PracticalDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RotationSlot" ADD CONSTRAINT "RotationSlot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RotationSlot" ADD CONSTRAINT "RotationSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RotationSlotItem" ADD CONSTRAINT "RotationSlotItem_rotationSlotId_fkey" FOREIGN KEY ("rotationSlotId") REFERENCES "RotationSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RotationSlotItem" ADD CONSTRAINT "RotationSlotItem_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RotationSlotItem" ADD CONSTRAINT "RotationSlotItem_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
