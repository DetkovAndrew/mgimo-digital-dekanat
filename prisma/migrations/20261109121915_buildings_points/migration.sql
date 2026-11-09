-- AlterTable
ALTER TABLE "assessment" ADD COLUMN     "maxPoints" INTEGER;

-- AlterTable
ALTER TABLE "grade_result" ADD COLUMN     "points" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "lesson" ADD COLUMN     "buildingId" TEXT;

-- AlterTable
ALTER TABLE "lesson_change" ADD COLUMN     "newBuildingId" TEXT,
ADD COLUMN     "previousBuildingId" TEXT;

-- CreateTable
CREATE TABLE "building" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "metro" TEXT,

    CONSTRAINT "building_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Баллы БаРС: результат может состоять только из баллов (добавлено вручную).
ALTER TABLE "grade_result" DROP CONSTRAINT "grade_result_one_outcome";
ALTER TABLE "grade_result"
  ADD CONSTRAINT "grade_result_has_outcome" CHECK ("grade" IS NOT NULL OR "passed" IS NOT NULL OR "points" IS NOT NULL),
  ADD CONSTRAINT "grade_result_grade_xor_passed" CHECK ("grade" IS NULL OR "passed" IS NULL),
  ADD CONSTRAINT "grade_result_points_nonnegative" CHECK ("points" IS NULL OR "points" >= 0);

ALTER TABLE "assessment"
  ADD CONSTRAINT "assessment_max_points_range" CHECK ("maxPoints" IS NULL OR "maxPoints" BETWEEN 1 AND 100);

ALTER TABLE "building"
  ADD CONSTRAINT "building_coordinates_range" CHECK ("lat" BETWEEN -90 AND 90 AND "lon" BETWEEN -180 AND 180);
