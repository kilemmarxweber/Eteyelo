-- Accusés de lecture certifiés pour avis officiels (__NOTIFY__).
CREATE TABLE IF NOT EXISTS "NoticeAck" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NoticeAck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NoticeAck_messageId_userId_key"
ON "NoticeAck"("messageId", "userId");

CREATE INDEX IF NOT EXISTS "NoticeAck_organizationId_createdAt_idx"
ON "NoticeAck"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "NoticeAck_messageId_idx"
ON "NoticeAck"("messageId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NoticeAck_messageId_fkey'
  ) THEN
    ALTER TABLE "NoticeAck"
    ADD CONSTRAINT "NoticeAck_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NoticeAck_userId_fkey'
  ) THEN
    ALTER TABLE "NoticeAck"
    ADD CONSTRAINT "NoticeAck_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NoticeAck_organizationId_fkey'
  ) THEN
    ALTER TABLE "NoticeAck"
    ADD CONSTRAINT "NoticeAck_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
