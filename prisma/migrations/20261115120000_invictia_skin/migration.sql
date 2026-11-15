-- AlterTable
ALTER TABLE "student_profile" ADD COLUMN "invictiaSkin" TEXT;

-- Дописано вручную: только идентификатор образа из кода (латиница), без произвольного текста.
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_invictia_skin_check" CHECK ("invictiaSkin" ~ '^[a-z]{1,32}$');
