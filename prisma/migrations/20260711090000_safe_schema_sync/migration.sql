-- Safe schema sync: align local DB with prisma/schema.prisma without data loss.

-- 1) Enum TypeBrache (schema: PRIMAIRE | SECONDAIRE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TypeBrache') THEN
    CREATE TYPE "TypeBrache" AS ENUM ('PRIMAIRE', 'SECONDAIRE');
  END IF;
END $$;

-- 2) Branch.typebranch
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "typebranch" "TypeBrache";
UPDATE "Branch" SET "typebranch" = 'SECONDAIRE' WHERE "typebranch" IS NULL;
ALTER TABLE "Branch" ALTER COLUMN "typebranch" SET NOT NULL;

-- 3) Branch.image TEXT -> JSONB (preserve existing values)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Branch'
      AND column_name = 'image'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "image_jsonb" JSONB;

    UPDATE "Branch"
    SET "image_jsonb" = CASE
      WHEN "image" IS NULL OR btrim("image") = '' THEN NULL
      WHEN btrim("image") LIKE '{%' OR btrim("image") LIKE '[%' THEN "image"::jsonb
      ELSE jsonb_build_object(
        'logo', NULL,
        'ecole', jsonb_build_array("image"),
        'event', '[]'::jsonb,
        'gallery', '[]'::jsonb
      )
    END;

    ALTER TABLE "Branch" DROP COLUMN "image";
    ALTER TABLE "Branch" RENAME COLUMN "image_jsonb" TO "image";
  END IF;
END $$;

-- 4) Student optional fields
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "observation" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "statusStudent" BOOLEAN DEFAULT false;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "provenanceEcole" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "suppositionClasseName" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "suppositionOption" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "suppositionSection" TEXT;

-- 5) CalendarEvent + archive fields
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

ALTER TABLE "Creneau" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Creneau" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Creneau" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

ALTER TABLE "SchoolYear" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SchoolYear" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "SchoolYear" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

-- 6) CoursOptionPonderation table + backfill from Cours.ponderation
CREATE TABLE IF NOT EXISTS "CoursOptionPonderation" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "ponderation" INTEGER NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoursOptionPonderation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Cours'
      AND column_name = 'ponderation'
  ) THEN
    INSERT INTO "CoursOptionPonderation" ("id", "coursId", "optionId", "ponderation", "branchId", "createdAt", "updatedAt")
    SELECT
      'cop_' || c."id" || '_' || o."id",
      c."id",
      o."id",
      COALESCE(c."ponderation", 1),
      c."branchId",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM "Cours" c
    INNER JOIN "Option" o ON o."branchId" = c."branchId"
    WHERE NOT EXISTS (
      SELECT 1
      FROM "CoursOptionPonderation" cop
      WHERE cop."branchId" = c."branchId"
        AND cop."coursId" = c."id"
        AND cop."optionId" = o."id"
    );

    ALTER TABLE "Cours" DROP COLUMN IF EXISTS "ponderation";
  END IF;
END $$;

-- 7) Classe.branchId required
UPDATE "Classe" SET "branchId" = (
  SELECT b."id" FROM "Branch" b LIMIT 1
) WHERE "branchId" IS NULL AND EXISTS (SELECT 1 FROM "Branch" b LIMIT 1);

ALTER TABLE "Classe" ALTER COLUMN "branchId" SET NOT NULL;

-- 8) Drop legacy global unique indexes
DROP INDEX IF EXISTS "Classe_codeClasse_key";
DROP INDEX IF EXISTS "Cours_codeCours_key";
DROP INDEX IF EXISTS "Option_codeOption_key";
DROP INDEX IF EXISTS "SchoolYear_nameYear_key";
DROP INDEX IF EXISTS "Section_codeSection_key";
DROP INDEX IF EXISTS "Section_nameSection_key";
DROP INDEX IF EXISTS "Semester_label_key";
DROP INDEX IF EXISTS "semester_label_key";

-- 9) Branch-scoped unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Classe_branchId_codeClasse_key" ON "Classe"("branchId", "codeClasse");
CREATE UNIQUE INDEX IF NOT EXISTS "Classe_branchId_nameClasse_key" ON "Classe"("branchId", "nameClasse");
CREATE UNIQUE INDEX IF NOT EXISTS "Cours_branchId_codeCours_key" ON "Cours"("branchId", "codeCours");
CREATE UNIQUE INDEX IF NOT EXISTS "Cours_branchId_nameCours_key" ON "Cours"("branchId", "nameCours");
CREATE UNIQUE INDEX IF NOT EXISTS "Creneau_branchId_nameCreneau_key" ON "Creneau"("branchId", "nameCreneau");
CREATE UNIQUE INDEX IF NOT EXISTS "Option_branchId_codeOption_key" ON "Option"("branchId", "codeOption");
CREATE UNIQUE INDEX IF NOT EXISTS "Option_branchId_nameOption_key" ON "Option"("branchId", "nameOption");
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolYear_branchId_nameYear_key" ON "SchoolYear"("branchId", "nameYear");
CREATE UNIQUE INDEX IF NOT EXISTS "Section_branchId_codeSection_key" ON "Section"("branchId", "codeSection");
CREATE UNIQUE INDEX IF NOT EXISTS "Section_branchId_nameSection_key" ON "Section"("branchId", "nameSection");

CREATE INDEX IF NOT EXISTS "Branch_organizationId_typebranch_idx" ON "Branch"("organizationId", "typebranch");
CREATE INDEX IF NOT EXISTS "CoursOptionPonderation_branchId_idx" ON "CoursOptionPonderation"("branchId");
CREATE INDEX IF NOT EXISTS "CoursOptionPonderation_coursId_idx" ON "CoursOptionPonderation"("coursId");
CREATE INDEX IF NOT EXISTS "CoursOptionPonderation_optionId_idx" ON "CoursOptionPonderation"("optionId");
CREATE UNIQUE INDEX IF NOT EXISTS "CoursOptionPonderation_branchId_coursId_optionId_key"
  ON "CoursOptionPonderation"("branchId", "coursId", "optionId");

CREATE INDEX IF NOT EXISTS "Creneau_branchId_isArchived_idx" ON "Creneau"("branchId", "isArchived");
CREATE INDEX IF NOT EXISTS "SchoolYear_branchId_isArchived_idx" ON "SchoolYear"("branchId", "isArchived");
CREATE INDEX IF NOT EXISTS "Schedule_isArchived_idx" ON "Schedule"("isArchived");

-- 10) Foreign keys for CoursOptionPonderation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CoursOptionPonderation_coursId_fkey'
  ) THEN
    ALTER TABLE "CoursOptionPonderation"
      ADD CONSTRAINT "CoursOptionPonderation_coursId_fkey"
      FOREIGN KEY ("coursId") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CoursOptionPonderation_optionId_fkey'
  ) THEN
    ALTER TABLE "CoursOptionPonderation"
      ADD CONSTRAINT "CoursOptionPonderation_optionId_fkey"
      FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CoursOptionPonderation_branchId_fkey'
  ) THEN
    ALTER TABLE "CoursOptionPonderation"
      ADD CONSTRAINT "CoursOptionPonderation_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 11) French period labels (idempotent)
UPDATE "period"
SET "label" = CASE "label"
  WHEN '1st Period' THEN '1ere Periode'
  WHEN '1er Periode' THEN '1ere Periode'
  WHEN '2nd Period' THEN '2e Periode'
  WHEN '3tr Period' THEN '3e Periode'
  WHEN '4th Period' THEN '4e Periode'
  WHEN 'Exam 1st semester' THEN 'Examen 1er semestre'
  WHEN 'Exam 2nd semester' THEN 'Examen 2e semestre'
  WHEN 'Exam 1er trimestre' THEN 'Examen 1er trimestre'
  WHEN 'Exam 2e trimestre' THEN 'Examen 2e trimestre'
  WHEN 'Exam 3e trimestre' THEN 'Examen 3e trimestre'
  ELSE "label"
END
WHERE "label" IN (
  '1st Period', '1er Periode', '2nd Period', '3tr Period', '4th Period',
  'Exam 1st semester', 'Exam 2nd semester',
  'Exam 1er trimestre', 'Exam 2e trimestre', 'Exam 3e trimestre'
);

UPDATE "fiche"
SET "periodeName" = CASE "periodeName"
  WHEN '1st Period' THEN '1ere Periode'
  WHEN '1er Periode' THEN '1ere Periode'
  WHEN '2nd Period' THEN '2e Periode'
  WHEN '3tr Period' THEN '3e Periode'
  WHEN '4th Period' THEN '4e Periode'
  WHEN 'Exam 1st semester' THEN 'Examen 1er semestre'
  WHEN 'Exam 2nd semester' THEN 'Examen 2e semestre'
  WHEN 'Exam 1er trimestre' THEN 'Examen 1er trimestre'
  WHEN 'Exam 2e trimestre' THEN 'Examen 2e trimestre'
  WHEN 'Exam 3e trimestre' THEN 'Examen 3e trimestre'
  ELSE "periodeName"
END
WHERE "periodeName" IN (
  '1st Period', '1er Periode', '2nd Period', '3tr Period', '4th Period',
  'Exam 1st semester', 'Exam 2nd semester',
  'Exam 1er trimestre', 'Exam 2e trimestre', 'Exam 3e trimestre'
);
