-- AlterTable Parent: infos famille complémentaires
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "nomMere" TEXT;
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "professionMere" TEXT;
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "tuteurNom" TEXT;
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "adresseTuteur" TEXT;
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "provinceOrigine" TEXT;
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "territoireOrigine" TEXT;
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "secteurOrigine" TEXT;
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "villageOrigine" TEXT;

-- AlterTable Student: infos élève complémentaires
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "nationalite" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "autreNationalite" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "territoireAutreNationalite" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "langue" TEXT;

-- AlterTable RegistrationRequest: lien fratrie multi-élèves
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "siblingGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "RegistrationRequest_siblingGroupId_idx" ON "RegistrationRequest"("siblingGroupId");
CREATE INDEX IF NOT EXISTS "RegistrationRequest_branchId_siblingGroupId_idx" ON "RegistrationRequest"("branchId", "siblingGroupId");
