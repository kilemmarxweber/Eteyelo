import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { getTeacherAttendanceReadScope } from "@/lib/auth/data-scope";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import AttendanceSectionLayout from "./attendance-section-layout";

export default async function AttendanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;

  await assertBranchAreaAccess("attendance", undefined, {
    organizationId,
    branchId,
  });

  const { session, userId } = await requireBranchContext({ onMissing: "redirect" });
  const teacherScope = await getTeacherAttendanceReadScope({
    session,
    userId,
    branchId,
  });

  return (
    <AttendanceSectionLayout canViewSchoolReports={!teacherScope}>
      {children}
    </AttendanceSectionLayout>
  );
}
