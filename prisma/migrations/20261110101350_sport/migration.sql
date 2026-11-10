-- CreateEnum
CREATE TYPE "SportWeekStatus" AS ENUM ('OPEN', 'DRAWN');

-- CreateEnum
CREATE TYPE "SportBookingStatus" AS ENUM ('CONFIRMED', 'WAITLIST', 'CANCELLED', 'ATTENDED', 'MISSED');

-- CreateTable
CREATE TABLE "sport_week" (
    "weekStart" DATE NOT NULL,
    "status" "SportWeekStatus" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMPTZ(6) NOT NULL,
    "seed" TEXT,
    "lotteryOrder" JSONB,
    "drawnAt" TIMESTAMPTZ(6),

    CONSTRAINT "sport_week_pkey" PRIMARY KEY ("weekStart")
);

-- CreateTable
CREATE TABLE "sport_section" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "sport_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_slot" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "buildingId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "coach" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "sport_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_preference" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sport_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_booking" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "status" "SportBookingStatus" NOT NULL,
    "rank" INTEGER,
    "lotteryIndex" INTEGER,
    "explanation" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sport_booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_extra_points" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "awardedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sport_extra_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sport_slot_weekStart_startsAt_idx" ON "sport_slot"("weekStart", "startsAt");

-- CreateIndex
CREATE INDEX "sport_preference_weekStart_idx" ON "sport_preference"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "sport_preference_studentId_slotId_key" ON "sport_preference"("studentId", "slotId");

-- CreateIndex
CREATE UNIQUE INDEX "sport_preference_studentId_weekStart_rank_key" ON "sport_preference"("studentId", "weekStart", "rank");

-- CreateIndex
CREATE INDEX "sport_booking_slotId_status_idx" ON "sport_booking"("slotId", "status");

-- CreateIndex
CREATE INDEX "sport_booking_studentId_weekStart_idx" ON "sport_booking"("studentId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "sport_booking_studentId_slotId_key" ON "sport_booking"("studentId", "slotId");

-- CreateIndex
CREATE INDEX "sport_extra_points_studentId_termId_idx" ON "sport_extra_points"("studentId", "termId");

-- AddForeignKey
ALTER TABLE "sport_slot" ADD CONSTRAINT "sport_slot_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sport_section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_slot" ADD CONSTRAINT "sport_slot_weekStart_fkey" FOREIGN KEY ("weekStart") REFERENCES "sport_week"("weekStart") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_slot" ADD CONSTRAINT "sport_slot_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_preference" ADD CONSTRAINT "sport_preference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_preference" ADD CONSTRAINT "sport_preference_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "sport_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_preference" ADD CONSTRAINT "sport_preference_weekStart_fkey" FOREIGN KEY ("weekStart") REFERENCES "sport_week"("weekStart") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_booking" ADD CONSTRAINT "sport_booking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_booking" ADD CONSTRAINT "sport_booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "sport_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_booking" ADD CONSTRAINT "sport_booking_weekStart_fkey" FOREIGN KEY ("weekStart") REFERENCES "sport_week"("weekStart") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_extra_points" ADD CONSTRAINT "sport_extra_points_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_extra_points" ADD CONSTRAINT "sport_extra_points_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Инварианты физкультуры (добавлено вручную).
ALTER TABLE "sport_slot"
  ADD CONSTRAINT "sport_slot_capacity_positive" CHECK ("capacity" > 0),
  ADD CONSTRAINT "sport_slot_time_order" CHECK ("endsAt" > "startsAt");
ALTER TABLE "sport_preference"
  ADD CONSTRAINT "sport_preference_rank_range" CHECK ("rank" BETWEEN 1 AND 6);
ALTER TABLE "sport_extra_points"
  ADD CONSTRAINT "sport_extra_points_range" CHECK ("points" BETWEEN 1 AND 40);
