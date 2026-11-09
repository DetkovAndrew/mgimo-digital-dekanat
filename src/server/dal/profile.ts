import "server-only";
import { prisma } from "../db";
import { requireStudent } from "../session";

export async function getMyProfile() {
  const { studentId } = await requireStudent();
  const p = await prisma.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      recordBookNumber: true,
      studyForm: true,
      funding: true,
      enrolledAt: true,
      user: { select: { name: true, username: true } },
      group: {
        select: {
          code: true,
          program: true,
          profile: true,
          course: true,
          level: true,
          faculty: { select: { title: true, shortName: true } },
        },
      },
    },
  });
  return {
    fullName: p.user.name,
    login: p.user.username,
    recordBookNumber: p.recordBookNumber,
    studyForm: p.studyForm,
    funding: p.funding,
    enrolledAt: p.enrolledAt,
    group: p.group.code,
    course: p.group.course,
    level: p.group.level,
    program: p.group.program,
    programProfile: p.group.profile,
    faculty: p.group.faculty.title,
    facultyShort: p.group.faculty.shortName,
  };
}

export type MyProfile = Awaited<ReturnType<typeof getMyProfile>>;
