import { isDualStaffMemberRole } from "@/lib/dual-staff-profile-shared";
import { teacherIdsWithScheduledCourseToday } from "@/lib/attendance-teacher-session";

export type DualStaffProfiles = {
  teacherId: string | null;
  personnelId: string | null;
  memberRole?: unknown;
};

export function isDualStaffProfiles(profiles: DualStaffProfiles): boolean {
  return Boolean(
    profiles.teacherId &&
      profiles.personnelId &&
      isDualStaffMemberRole(profiles.memberRole),
  );
}

export async function resolveDualStaffAttendanceMode(
  branchId: string,
  profiles: DualStaffProfiles,
): Promise<"teacher" | "personnel" | null> {
  if (!isDualStaffProfiles(profiles) || !profiles.teacherId) return null;
  const withCourse = await teacherIdsWithScheduledCourseToday(
    [profiles.teacherId],
    branchId,
  );
  return withCourse.has(profiles.teacherId) ? "teacher" : "personnel";
}

export async function dualStaffTeacherIdsWithCourseToday(
  branchId: string,
  teacherIds: string[],
): Promise<Set<string>> {
  return teacherIdsWithScheduledCourseToday(teacherIds, branchId);
}
