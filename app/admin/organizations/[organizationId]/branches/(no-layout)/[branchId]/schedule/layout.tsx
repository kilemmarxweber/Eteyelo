import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import ScheduleSectionLayout from "./schedule-section-layout";

export default async function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("schedule");
  return <ScheduleSectionLayout>{children}</ScheduleSectionLayout>;
}
