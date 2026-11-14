-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'PRINTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "print_job" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "pages" INTEGER NOT NULL,
    "copies" INTEGER NOT NULL,
    "color" BOOLEAN NOT NULL,
    "duplex" BOOLEAN NOT NULL,
    "cost" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'QUEUED',
    "printerId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "printedAt" TIMESTAMPTZ(6),

    CONSTRAINT "print_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wifi_credential" (
    "studentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rotatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wifi_credential_pkey" PRIMARY KEY ("studentId")
);

-- CreateIndex
CREATE INDEX "print_job_studentId_createdAt_idx" ON "print_job"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wifi_credential" ADD CONSTRAINT "wifi_credential_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Дописано вручную (docs/plans/services.md): границы дублируют проверки в src/lib/services/print.ts.
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_pages_range" CHECK ("pages" BETWEEN 1 AND 200);
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_copies_range" CHECK ("copies" BETWEEN 1 AND 5);
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_cost_positive" CHECK ("cost" > 0);
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_code_format" CHECK ("code" ~ '^[0-9]{6}$');
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_file_name_length" CHECK (char_length("fileName") BETWEEN 1 AND 120);
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_printed_consistent" CHECK (("status" = 'PRINTED') = ("printedAt" IS NOT NULL AND "printerId" IS NOT NULL));
ALTER TABLE "wifi_credential" ADD CONSTRAINT "wifi_credential_version_positive" CHECK ("version" >= 1);
-- Код у принтера однозначен среди заданий в очереди; совпадение — повтор транзакции в DAL.
CREATE UNIQUE INDEX "print_job_queued_code_key" ON "print_job" ("code") WHERE "status" = 'QUEUED';
