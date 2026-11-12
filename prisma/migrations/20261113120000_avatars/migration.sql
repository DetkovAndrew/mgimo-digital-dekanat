-- CreateTable
CREATE TABLE "student_avatar" (
    "studentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_avatar_pkey" PRIMARY KEY ("studentId")
);

-- AddForeignKey
ALTER TABLE "student_avatar" ADD CONSTRAINT "student_avatar_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Дописано вручную: только картинки из белого списка и не больше 200 КиБ (дублирует проверку в src/server/dal/avatar.ts).
ALTER TABLE "student_avatar" ADD CONSTRAINT "student_avatar_mime_check" CHECK ("mime" IN ('image/webp', 'image/jpeg', 'image/png'));
ALTER TABLE "student_avatar" ADD CONSTRAINT "student_avatar_size_check" CHECK (octet_length("data") BETWEEN 1 AND 204800);
