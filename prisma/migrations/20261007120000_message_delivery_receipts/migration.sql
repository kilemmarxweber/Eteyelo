-- Accusés de réception de messages, distincts des accusés de lecture.
CREATE TABLE "MessageDeliveryReceipt" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageDeliveryReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageDeliveryReceipt_messageId_userId_key"
ON "MessageDeliveryReceipt"("messageId", "userId");

CREATE INDEX "MessageDeliveryReceipt_userId_deliveredAt_idx"
ON "MessageDeliveryReceipt"("userId", "deliveredAt");

CREATE INDEX "MessageDeliveryReceipt_messageId_idx"
ON "MessageDeliveryReceipt"("messageId");

ALTER TABLE "MessageDeliveryReceipt"
ADD CONSTRAINT "MessageDeliveryReceipt_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageDeliveryReceipt"
ADD CONSTRAINT "MessageDeliveryReceipt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
