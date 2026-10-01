-- Group messaging: lock replies + participant roles (schema had fields without migration).

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "repliesLocked" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "ConversationParticipantRole" AS ENUM ('ADMIN', 'MEMBER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ConversationParticipant"
  ADD COLUMN IF NOT EXISTS "role" "ConversationParticipantRole" NOT NULL DEFAULT 'MEMBER';

CREATE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_role_idx"
  ON "ConversationParticipant"("conversationId", "role");