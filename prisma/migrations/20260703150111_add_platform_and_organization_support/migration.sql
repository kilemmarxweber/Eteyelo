-- CreateEnum
CREATE TYPE "PlatformSupportEscalationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "platformSupportAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayTitle" TEXT,
    "bio" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platformSupportAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizationSupportAgent" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayTitle" TEXT,
    "bio" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizationSupportAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizationSupportBranchScope" (
    "id" TEXT NOT NULL,
    "supportId" TEXT NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "organizationSupportBranchScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platformSupportEscalation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationSupportId" TEXT,
    "requesterUserId" TEXT NOT NULL,
    "assignedPlatformAgentId" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "PlatformSupportEscalationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "platformSupportEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platformSupportAgent_userId_key" ON "platformSupportAgent"("userId");

-- CreateIndex
CREATE INDEX "platformSupportAgent_isActive_idx" ON "platformSupportAgent"("isActive");

-- CreateIndex
CREATE INDEX "platformSupportAgent_sortOrder_idx" ON "platformSupportAgent"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "organizationSupportAgent_memberId_key" ON "organizationSupportAgent"("memberId");

-- CreateIndex
CREATE INDEX "organizationSupportAgent_organizationId_idx" ON "organizationSupportAgent"("organizationId");

-- CreateIndex
CREATE INDEX "organizationSupportAgent_organizationId_isActive_idx" ON "organizationSupportAgent"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "organizationSupportBranchScope_supportId_idx" ON "organizationSupportBranchScope"("supportId");

-- CreateIndex
CREATE INDEX "organizationSupportBranchScope_branchId_idx" ON "organizationSupportBranchScope"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "organizationSupportBranchScope_supportId_branchId_key" ON "organizationSupportBranchScope"("supportId", "branchId");

-- CreateIndex
CREATE INDEX "platformSupportEscalation_organizationId_idx" ON "platformSupportEscalation"("organizationId");

-- CreateIndex
CREATE INDEX "platformSupportEscalation_requesterUserId_idx" ON "platformSupportEscalation"("requesterUserId");

-- CreateIndex
CREATE INDEX "platformSupportEscalation_status_idx" ON "platformSupportEscalation"("status");

-- CreateIndex
CREATE INDEX "platformSupportEscalation_assignedPlatformAgentId_idx" ON "platformSupportEscalation"("assignedPlatformAgentId");

-- AddForeignKey
ALTER TABLE "platformSupportAgent" ADD CONSTRAINT "platformSupportAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationSupportAgent" ADD CONSTRAINT "organizationSupportAgent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationSupportAgent" ADD CONSTRAINT "organizationSupportAgent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationSupportBranchScope" ADD CONSTRAINT "organizationSupportBranchScope_supportId_fkey" FOREIGN KEY ("supportId") REFERENCES "organizationSupportAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationSupportBranchScope" ADD CONSTRAINT "organizationSupportBranchScope_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platformSupportEscalation" ADD CONSTRAINT "platformSupportEscalation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platformSupportEscalation" ADD CONSTRAINT "platformSupportEscalation_organizationSupportId_fkey" FOREIGN KEY ("organizationSupportId") REFERENCES "organizationSupportAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platformSupportEscalation" ADD CONSTRAINT "platformSupportEscalation_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platformSupportEscalation" ADD CONSTRAINT "platformSupportEscalation_assignedPlatformAgentId_fkey" FOREIGN KEY ("assignedPlatformAgentId") REFERENCES "platformSupportAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
