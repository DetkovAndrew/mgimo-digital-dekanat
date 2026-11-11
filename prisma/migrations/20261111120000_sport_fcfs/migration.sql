-- Физкультура «успел — записался»: без приоритетов и жеребьёвки (docs/plans/sport-fcfs.md).
-- Очередь — FIFO по statusAt (момент последней смены статуса).
-- DropForeignKey
ALTER TABLE "sport_preference" DROP CONSTRAINT "sport_preference_slotId_fkey";

-- DropForeignKey
ALTER TABLE "sport_preference" DROP CONSTRAINT "sport_preference_studentId_fkey";

-- DropForeignKey
ALTER TABLE "sport_preference" DROP CONSTRAINT "sport_preference_weekStart_fkey";

-- AlterTable
ALTER TABLE "sport_booking" DROP COLUMN "explanation",
DROP COLUMN "lotteryIndex",
DROP COLUMN "rank",
ADD COLUMN     "statusAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sport_week" DROP COLUMN "deadline",
DROP COLUMN "drawnAt",
DROP COLUMN "lotteryOrder",
DROP COLUMN "seed",
DROP COLUMN "status";

-- DropTable
DROP TABLE "sport_preference";

-- DropEnum
DROP TYPE "SportWeekStatus";

