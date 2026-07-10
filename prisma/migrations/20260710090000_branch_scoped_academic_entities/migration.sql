-- Scope academic setup entities to their branch instead of enforcing global names/codes.

DROP INDEX IF EXISTS "Classe_codeClasse_key";
DROP INDEX IF EXISTS "Option_codeOption_key";
DROP INDEX IF EXISTS "Section_codeSection_key";
DROP INDEX IF EXISTS "Section_nameSection_key";
DROP INDEX IF EXISTS "SchoolYear_nameYear_key";

ALTER TABLE "Classe" ALTER COLUMN "branchId" SET NOT NULL;

CREATE UNIQUE INDEX "Classe_branchId_codeClasse_key" ON "Classe"("branchId", "codeClasse");
CREATE UNIQUE INDEX "Classe_branchId_nameClasse_key" ON "Classe"("branchId", "nameClasse");
CREATE UNIQUE INDEX "Creneau_branchId_nameCreneau_key" ON "Creneau"("branchId", "nameCreneau");
CREATE UNIQUE INDEX "Option_branchId_codeOption_key" ON "Option"("branchId", "codeOption");
CREATE UNIQUE INDEX "Option_branchId_nameOption_key" ON "Option"("branchId", "nameOption");
CREATE UNIQUE INDEX "Section_branchId_codeSection_key" ON "Section"("branchId", "codeSection");
CREATE UNIQUE INDEX "Section_branchId_nameSection_key" ON "Section"("branchId", "nameSection");
CREATE UNIQUE INDEX "SchoolYear_branchId_nameYear_key" ON "SchoolYear"("branchId", "nameYear");
