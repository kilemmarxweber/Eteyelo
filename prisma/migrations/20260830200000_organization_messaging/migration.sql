-- Messagerie organisationnelle (conversations, messages, archivage personnel).

CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP', 'CONTEXTUAL');

CREATE TYPE "ConversationContextType" AS ENUM (
  'ABSENCE_CASE',
  'GRADE_MODIFICATION',
  'REGISTRATION_REQUEST',
  'SUPPORT_TICKET'
);

DO $$ BEGIN
  ALTER TYPE "AppNotificationType" ADD VALUE 'MESSAGE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AppNotification" ALTER COLUMN "branchId" DROP NOT NULL;
ALTER TABLE "AppNotification" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "AppNotification" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
ALTER TABLE "AppNotification" ADD COLUMN IF NOT EXISTS "messageId" TEXT;

UPDATE "AppNotification" AS n
SET "organizationId" = b."organizationId"
FROM "Branch" AS b
WHERE n."branchId" = b."id"
  AND n."organizationId" IS NULL;

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
  "subject" TEXT,
  "createdById" TEXT NOT NULL,
  "sourceBranchId" TEXT,
  "contextType" "ConversationContextType",
  "contextId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationParticipant" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "mutedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),

  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "replyToId" TEXT,
  "clientMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserMessageArchive" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserMessageArchive_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagingAuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessagingAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Conversation_organizationId_updatedAt_idx" ON "Conversation"("organizationId", "updatedAt");
CREATE INDEX "Conversation_organizationId_deletedAt_idx" ON "Conversation"("organizationId", "deletedAt");
CREATE INDEX "Conversation_contextType_contextId_idx" ON "Conversation"("contextType", "contextId");
CREATE INDEX "Conversation_createdById_idx" ON "Conversation"("createdById");

CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");
CREATE INDEX "ConversationParticipant_userId_lastReadAt_archivedAt_idx" ON "ConversationParticipant"("userId", "lastReadAt", "archivedAt");
CREATE INDEX "ConversationParticipant_userId_archivedAt_idx" ON "ConversationParticipant"("userId", "archivedAt");

CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");
CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key" ON "Message"("senderId", "clientMessageId") WHERE "clientMessageId" IS NOT NULL;

CREATE UNIQUE INDEX "UserMessageArchive_userId_messageId_key" ON "UserMessageArchive"("userId", "messageId");
CREATE INDEX "UserMessageArchive_userId_archivedAt_idx" ON "UserMessageArchive"("userId", "archivedAt");

CREATE INDEX "MessagingAuditLog_organizationId_createdAt_idx" ON "MessagingAuditLog"("organizationId", "createdAt");
CREATE INDEX "MessagingAuditLog_actorUserId_createdAt_idx" ON "MessagingAuditLog"("actorUserId", "createdAt");

CREATE INDEX "AppNotification_organizationId_userId_createdAt_idx" ON "AppNotification"("organizationId", "userId", "createdAt");
CREATE INDEX "AppNotification_conversationId_idx" ON "AppNotification"("conversationId");
CREATE INDEX "AppNotification_messageId_userId_idx" ON "AppNotification"("messageId", "userId");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_sourceBranchId_fkey"
  FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserMessageArchive"
  ADD CONSTRAINT "UserMessageArchive_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMessageArchive"
  ADD CONSTRAINT "UserMessageArchive_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessagingAuditLog"
  ADD CONSTRAINT "MessagingAuditLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessagingAuditLog"
  ADD CONSTRAINT "MessagingAuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppNotification"
  ADD CONSTRAINT "AppNotification_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppNotification"
  ADD CONSTRAINT "AppNotification_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
