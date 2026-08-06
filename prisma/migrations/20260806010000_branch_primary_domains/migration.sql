-- Convert Cours.primaryDomain from enum to text
ALTER TABLE "Cours" ALTER COLUMN "primaryDomain" TYPE TEXT USING "primaryDomain"::text;

-- Drop legacy enum
DROP TYPE IF EXISTS "PrimaryDomain";

-- Branch-scoped editable primary domains
CREATE TABLE "BranchPrimaryDomain" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchPrimaryDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchPrimaryDomain_branchId_code_key" ON "BranchPrimaryDomain"("branchId", "code");

CREATE INDEX "BranchPrimaryDomain_branchId_sortOrder_idx" ON "BranchPrimaryDomain"("branchId", "sortOrder");

ALTER TABLE "BranchPrimaryDomain" ADD CONSTRAINT "BranchPrimaryDomain_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default RDC domains for every existing branch
INSERT INTO "BranchPrimaryDomain" ("id", "branchId", "code", "label", "shortLabel", "sortOrder", "isSystem", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  b."id",
  d.code,
  d.label,
  d."shortLabel",
  d."sortOrder",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Branch" b
CROSS JOIN (
  VALUES
    ('LANGUES', 'DOMAINE DES LANGUES', 'Langues', 10),
    ('MATH_SCIENCES_TECH', 'DOMAINES DES MATHEMATIQUES, SCIENCES ET TECHNOLOGIE', 'Math / Sciences / Tech', 20),
    ('UNIVERS_SOCIAUX', 'DOMAINE DE L''UNIVERS SOCIAL ET ENVIRONNEMENT', 'Univers social & environnement', 30),
    ('ARTS', 'DOMAINE DES ARTS ET CULTURE', 'Arts & culture', 40),
    ('DEVELOPPEMENT', 'DOMAINE DE DEVELOPPEMENT PERSONNEL', 'Développement personnel', 50)
) AS d(code, label, "shortLabel", "sortOrder");
