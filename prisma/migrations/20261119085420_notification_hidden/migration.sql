-- AlterTable
ALTER TABLE "notification_recipient" ADD COLUMN     "hiddenAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "notification_recipient_userId_hiddenAt_idx" ON "notification_recipient"("userId", "hiddenAt");
