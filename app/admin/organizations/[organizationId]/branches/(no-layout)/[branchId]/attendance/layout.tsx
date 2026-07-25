import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import AttendanceSectionLayout from "./attendance-section-layout";

export default async function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("teaching");
  return <AttendanceSectionLayout>{children}</AttendanceSectionLayout>;
}
