import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import AttendanceSectionLayout from "./attendance-section-layout";

export default async function AttendanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;

  await assertBranchAreaAccess("teaching", undefined, {
    organizationId,
    branchId,
  });

  return <AttendanceSectionLayout>{children}</AttendanceSectionLayout>;
}
