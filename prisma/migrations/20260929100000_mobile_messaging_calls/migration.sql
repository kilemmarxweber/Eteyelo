-- CreateEnum
CREATE TYPE "MessageAttachmentKind" AS ENUM ('IMAGE', 'AUDIO', 'FILE', 'VIDEO');

-- CreateEnum
CREATE TYPE "UserPresenceStatus" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "CallKind" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'ENDED', 'MISSED', 'REJECTED');

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" "MessageAttachmentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "durationMs" INTEGER,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPresence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "UserPresenceStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT,
    "callerId" TEXT NOT NULL,
    "calleeId" TEXT NOT NULL,
    "kind" "CallKind" NOT NULL DEFAULT 'AUDIO',
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "UserPresence_organizationId_status_idx" ON "UserPresence"("organizationId", "status");

-- CreateIndex
CREATE INDEX "UserPresence_userId_idx" ON "UserPresence"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPresence_userId_organizationId_key" ON "UserPresence"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "CallSession_organizationId_startedAt_idx" ON "CallSession"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "CallSession_callerId_startedAt_idx" ON "CallSession"("callerId", "startedAt");

-- CreateIndex
CREATE INDEX "CallSession_calleeId_startedAt_idx" ON "CallSession"("calleeId", "startedAt");

-- CreateIndex
CREATE INDEX "CallSession_conversationId_idx" ON "CallSession"("conversationId");

-- CreateIndex
CREATE INDEX "CallSession_status_idx" ON "CallSession"("status");

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPresence" ADD CONSTRAINT "UserPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPresence" ADD CONSTRAINT "UserPresence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_calleeId_fkey" FOREIGN KEY ("calleeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
