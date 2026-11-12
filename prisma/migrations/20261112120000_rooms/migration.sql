-- Аудитории со схем корпусов и бронирование студентами (docs/plans/rooms.md).
-- CreateEnum
CREATE TYPE "RoomKind" AS ENUM ('LECTURE_HALL', 'CLASSROOM', 'COMPUTER_LAB', 'LAB', 'COWORKING', 'MEETING');

-- CreateEnum
CREATE TYPE "RoomBookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "lesson" ADD COLUMN     "roomId" TEXT;

-- CreateTable
CREATE TABLE "room" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "wing" INTEGER NOT NULL,
    "floor" INTEGER NOT NULL,
    "kind" "RoomKind" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bookable" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_booking" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "RoomBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(6),

    CONSTRAINT "room_booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_buildingId_number_key" ON "room"("buildingId", "number");

-- CreateIndex
CREATE INDEX "room_booking_roomId_startsAt_idx" ON "room_booking"("roomId", "startsAt");

-- CreateIndex
CREATE INDEX "room_booking_studentId_startsAt_idx" ON "room_booking"("studentId", "startsAt");

-- CreateIndex
CREATE INDEX "lesson_roomId_startsAt_idx" ON "lesson"("roomId", "startsAt");

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_booking" ADD CONSTRAINT "room_booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_booking" ADD CONSTRAINT "room_booking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ручные ограничения (как в прежних миграциях): корректный интервал, вместимость и номер на схеме.
ALTER TABLE "room_booking" ADD CONSTRAINT "room_booking_interval_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "room_booking" ADD CONSTRAINT "room_booking_purpose_check" CHECK (char_length("purpose") BETWEEN 2 AND 120);
ALTER TABLE "room" ADD CONSTRAINT "room_capacity_check" CHECK ("capacity" > 0);
ALTER TABLE "room" ADD CONSTRAINT "room_place_check" CHECK ("wing" > 0 AND "floor" > 0);
