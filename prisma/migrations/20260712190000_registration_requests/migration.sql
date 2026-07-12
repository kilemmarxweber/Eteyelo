CREATE TYPE "RegistrationRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'REGISTERED', 'ARCHIVED');

CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolYearId" TEXT,
    "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "studentData" JSONB NOT NULL,
    "guardiansData" JSONB NOT NULL,
    "requestedLevel" TEXT,
    "requestedSection" TEXT,
    "requestedOption" TEXT,
    "photoUrl" TEXT,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "registeredById" TEXT,
    "registeredAt" TIMESTAMP(3),
    "studentId" TEXT,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationRequest_reference_key" ON "RegistrationRequest"("reference");
CREATE INDEX "RegistrationRequest_branchId_status_createdAt_idx" ON "RegistrationRequest"("branchId", "status", "createdAt");
CREATE INDEX "RegistrationRequest_organizationId_branchId_idx" ON "RegistrationRequest"("organizationId", "branchId");
CREATE INDEX "RegistrationRequest_schoolYearId_idx" ON "RegistrationRequest"("schoolYearId");
CREATE INDEX "RegistrationRequest_studentId_idx" ON "RegistrationRequest"("studentId");
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
