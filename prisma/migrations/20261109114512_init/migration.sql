-- CreateEnum
CREATE TYPE "ControlForm" AS ENUM ('EXAM', 'CREDIT', 'GRADED_CREDIT');

-- CreateEnum
CREATE TYPE "LessonKind" AS ENUM ('LECTURE', 'SEMINAR', 'LANGUAGE', 'PRACTICE', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('EXAM', 'CREDIT', 'GRADED_CREDIT', 'MIDTERM', 'ASSIGNMENT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'IN_PROGRESS', 'NEEDS_INFO', 'READY', 'DONE', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('STUDENT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('ANNOUNCEMENT', 'SCHEDULE_CHANGE', 'DEADLINE', 'REQUEST_STATUS');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "role" TEXT NOT NULL DEFAULT 'student',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "recordBookNumber" TEXT NOT NULL,
    "studyForm" TEXT NOT NULL DEFAULT 'очная',
    "funding" TEXT NOT NULL,
    "enrolledAt" DATE NOT NULL,

    CONSTRAINT "student_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "facultyCode" TEXT NOT NULL,

    CONSTRAINT "staff_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty" (
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,

    CONSTRAINT "faculty_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "study_group" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "facultyCode" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "profile" TEXT,
    "course" INTEGER NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'бакалавриат',

    CONSTRAINT "study_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_term" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "sessionStartsOn" DATE NOT NULL,
    "sessionEndsOn" DATE NOT NULL,

    CONSTRAINT "academic_term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discipline" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,

    CONSTRAINT "discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,

    CONSTRAINT "teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_offering" (
    "id" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "leadTeacherId" TEXT NOT NULL,
    "controlForm" "ControlForm" NOT NULL,
    "credits" INTEGER NOT NULL,

    CONSTRAINT "course_offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "kind" "LessonKind" NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "room" TEXT,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "teacherId" TEXT,
    "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_change" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "previousStatus" "LessonStatus" NOT NULL,
    "newStatus" "LessonStatus" NOT NULL,
    "previousStartsAt" TIMESTAMPTZ(6) NOT NULL,
    "previousEndsAt" TIMESTAMPTZ(6) NOT NULL,
    "previousRoom" TEXT,
    "newStartsAt" TIMESTAMPTZ(6) NOT NULL,
    "newEndsAt" TIMESTAMPTZ(6) NOT NULL,
    "newRoom" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ(6),
    "dueAt" TIMESTAMPTZ(6),
    "room" TEXT,

    CONSTRAINT "assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_result" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "grade" INTEGER,
    "passed" BOOLEAN,
    "comment" TEXT,
    "gradedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grade_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_event" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorUserId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lessonId" TEXT,
    "requestId" TEXT,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipient" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(6),

    CONSTRAINT "notification_recipient_pkey" PRIMARY KEY ("notificationId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_userId_key" ON "student_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_recordBookNumber_key" ON "student_profile"("recordBookNumber");

-- CreateIndex
CREATE INDEX "student_profile_groupId_idx" ON "student_profile"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profile_userId_key" ON "staff_profile"("userId");

-- CreateIndex
CREATE INDEX "staff_profile_facultyCode_idx" ON "staff_profile"("facultyCode");

-- CreateIndex
CREATE UNIQUE INDEX "study_group_code_key" ON "study_group"("code");

-- CreateIndex
CREATE INDEX "study_group_facultyCode_idx" ON "study_group"("facultyCode");

-- CreateIndex
CREATE INDEX "course_offering_groupId_termId_idx" ON "course_offering"("groupId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "course_offering_disciplineId_groupId_termId_key" ON "course_offering"("disciplineId", "groupId", "termId");

-- CreateIndex
CREATE INDEX "lesson_offeringId_startsAt_idx" ON "lesson"("offeringId", "startsAt");

-- CreateIndex
CREATE INDEX "lesson_startsAt_idx" ON "lesson"("startsAt");

-- CreateIndex
CREATE INDEX "lesson_change_lessonId_createdAt_idx" ON "lesson_change"("lessonId", "createdAt");

-- CreateIndex
CREATE INDEX "assessment_offeringId_idx" ON "assessment"("offeringId");

-- CreateIndex
CREATE INDEX "grade_result_assessmentId_idx" ON "grade_result"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "grade_result_studentId_assessmentId_attempt_key" ON "grade_result"("studentId", "assessmentId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "request_number_key" ON "request"("number");

-- CreateIndex
CREATE INDEX "request_studentId_createdAt_idx" ON "request"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "request_status_idx" ON "request"("status");

-- CreateIndex
CREATE INDEX "request_event_requestId_createdAt_idx" ON "request_event"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_publishedAt_idx" ON "notification"("publishedAt");

-- CreateIndex
CREATE INDEX "notification_lessonId_idx" ON "notification"("lessonId");

-- CreateIndex
CREATE INDEX "notification_requestId_idx" ON "notification"("requestId");

-- CreateIndex
CREATE INDEX "notification_recipient_userId_readAt_idx" ON "notification_recipient"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "study_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_facultyCode_fkey" FOREIGN KEY ("facultyCode") REFERENCES "faculty"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_group" ADD CONSTRAINT "study_group_facultyCode_fkey" FOREIGN KEY ("facultyCode") REFERENCES "faculty"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offering" ADD CONSTRAINT "course_offering_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offering" ADD CONSTRAINT "course_offering_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "study_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offering" ADD CONSTRAINT "course_offering_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offering" ADD CONSTRAINT "course_offering_leadTeacherId_fkey" FOREIGN KEY ("leadTeacherId") REFERENCES "teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_change" ADD CONSTRAINT "lesson_change_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_result" ADD CONSTRAINT "grade_result_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_result" ADD CONSTRAINT "grade_result_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_event" ADD CONSTRAINT "request_event_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_event" ADD CONSTRAINT "request_event_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient" ADD CONSTRAINT "notification_recipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient" ADD CONSTRAINT "notification_recipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Инварианты, которые Prisma не выражает в схеме (добавлено вручную).
ALTER TABLE "grade_result"
  ADD CONSTRAINT "grade_result_attempt_positive" CHECK ("attempt" > 0),
  ADD CONSTRAINT "grade_result_grade_range" CHECK ("grade" IS NULL OR "grade" BETWEEN 2 AND 5),
  ADD CONSTRAINT "grade_result_one_outcome" CHECK (("grade" IS NULL) <> ("passed" IS NULL));

ALTER TABLE "lesson"
  ADD CONSTRAINT "lesson_time_order" CHECK ("endsAt" > "startsAt");

ALTER TABLE "lesson_change"
  ADD CONSTRAINT "lesson_change_time_order" CHECK ("newEndsAt" > "newStartsAt");

ALTER TABLE "academic_term"
  ADD CONSTRAINT "academic_term_date_order" CHECK (
    "startsOn" < "endsOn" AND "sessionStartsOn" <= "sessionEndsOn" AND "startsOn" <= "sessionStartsOn"
  );

ALTER TABLE "study_group"
  ADD CONSTRAINT "study_group_course_range" CHECK ("course" BETWEEN 1 AND 6);
