-- Align incomplete BranchRegistrationInfo table created before full migration.
ALTER TABLE "BranchRegistrationInfo"
ADD COLUMN IF NOT EXISTS "registrationFeeTypeId" TEXT;
