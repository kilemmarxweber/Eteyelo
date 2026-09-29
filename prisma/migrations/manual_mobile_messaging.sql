-- Migration manuelle Klambo Messagerie (à appliquer sur Postgres Eteyelo)
-- Ou: cd Eteyelo && pnpm prisma migrate dev --name mobile_messaging

CREATE TYPE "MessageAttachmentKind" AS ENUM ('IMAGE', 'AUDIO', 'FILE', 'VIDEO');
CREATE TYPE "UserPresenceStatus" AS ENUM ('ONLINE', 'OFFLINE');
CREATE TYPE "CallKind" AS ENUM ('AUDIO', 'VIDEO');
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'ENDED', 'MISSED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "MessageAttachment" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL REFERENCES "Message"("id") ON DELETE CASCADE,
  "kind" "MessageAttachmentKind" NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "durationMs" INTEGER,
  "fileName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

CREATE TABLE IF NOT EXISTS "UserPresence" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "organizationId" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "status" "UserPresenceStatus" NOT NULL DEFAULT 'OFFLINE',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserPresence_userId_organizationId_key"
  ON "UserPresence"("userId", "organizationId");
CREATE INDEX IF NOT EXISTS "UserPresence_organizationId_status_idx"
  ON "UserPresence"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "CallSession" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "conversationId" TEXT REFERENCES "Conversation"("id") ON DELETE SET NULL,
  "callerId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "calleeId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "kind" "CallKind" NOT NULL DEFAULT 'AUDIO',
  "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "endReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "CallSession_organizationId_startedAt_idx"
  ON "CallSession"("organizationId", "startedAt");
CREATE INDEX IF NOT EXISTS "CallSession_callerId_startedAt_idx"
  ON "CallSession"("callerId", "startedAt");
CREATE INDEX IF NOT EXISTS "CallSession_calleeId_startedAt_idx"
  ON "CallSession"("calleeId", "startedAt");
CREATE INDEX IF NOT EXISTS "CallSession_conversationId_idx"
  ON "CallSession"("conversationId");
CREATE INDEX IF NOT EXISTS "CallSession_status_idx" ON "CallSession"("status");
