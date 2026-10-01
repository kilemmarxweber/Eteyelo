DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParentFeedbackSource') THEN
    CREATE TYPE "ParentFeedbackSource" AS ENUM ('WEB', 'KLAMBO');
  END IF;
END $$;

ALTER TABLE "ParentFeedback"
ADD COLUMN IF NOT EXISTS "source" "ParentFeedbackSource" NOT NULL DEFAULT 'WEB';

CREATE TABLE IF NOT EXISTS "ParentSatisfactionDispatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "calendarYear" INTEGER NOT NULL,
  "conversationId" TEXT,
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ParentSatisfactionDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ParentSatisfactionDispatch_userId_organizationId_month_cal_key"
ON "ParentSatisfactionDispatch"("userId", "organizationId", "month", "calendarYear");

CREATE INDEX IF NOT EXISTS "ParentSatisfactionDispatch_organizationId_month_calendarYe_idx"
ON "ParentSatisfactionDispatch"("organizationId", "month", "calendarYear");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ParentSatisfactionDispatch_userId_fkey'
  ) THEN
    ALTER TABLE "ParentSatisfactionDispatch"
    ADD CONSTRAINT "ParentSatisfactionDispatch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ParentSatisfactionDispatch_organizationId_fkey'
  ) THEN
    ALTER TABLE "ParentSatisfactionDispatch"
    ADD CONSTRAINT "ParentSatisfactionDispatch_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
