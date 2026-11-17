-- AlterTable
ALTER TABLE "lesson_change" ADD COLUMN     "previousOnline" BOOLEAN,
ADD COLUMN     "staffId" TEXT;

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "staffId" TEXT;

-- CreateIndex
CREATE INDEX "lesson_change_staffId_idx" ON "lesson_change"("staffId");

-- CreateIndex
CREATE INDEX "notification_staffId_idx" ON "notification"("staffId");

-- AddForeignKey
ALTER TABLE "lesson_change" ADD CONSTRAINT "lesson_change_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
