CREATE TYPE "TemporaryGrantStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

CREATE TABLE "temporary_grant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "branchId" TEXT,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL DEFAULT '*',
  "temporaryRole" TEXT,
  "reason" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "TemporaryGrantStatus" NOT NULL DEFAULT 'ACTIVE',
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revocationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "temporary_grant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "temporary_grant_userId_status_expiresAt_idx" ON "temporary_grant"("userId", "status", "expiresAt");
CREATE INDEX "temporary_grant_organizationId_status_idx" ON "temporary_grant"("organizationId", "status");

ALTER TABLE "temporary_grant" ADD CONSTRAINT "temporary_grant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_grant" ADD CONSTRAINT "temporary_grant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_grant" ADD CONSTRAINT "temporary_grant_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_grant" ADD CONSTRAINT "temporary_grant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_grant" ADD CONSTRAINT "temporary_grant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
