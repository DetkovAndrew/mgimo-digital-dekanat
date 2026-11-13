import "server-only";
import { requireStudent, type StudentContext } from "../session";
import { createPassCode } from "../pass/token";
import { getMyAvatarUrl } from "./avatar";
import { getMyProfile } from "./profile";

/** Только для доверенного контекста, полученного из studentForApi/requireStudent, а не из тела или URL. */
export function issueStudentPass(student: StudentContext, now: number) {
  return createPassCode(student.studentId, process.env.BETTER_AUTH_SECRET ?? "", now);
}

export async function getMyPassPage() {
  const { userId } = await requireStudent();
  const [profile, avatar] = await Promise.all([getMyProfile(), getMyAvatarUrl()]);
  return {
    owner: userId,
    avatar,
    profile: { fullName: profile.fullName, group: profile.group, recordBookNumber: profile.recordBookNumber },
  };
}

export type PassPageData = Awaited<ReturnType<typeof getMyPassPage>>;
