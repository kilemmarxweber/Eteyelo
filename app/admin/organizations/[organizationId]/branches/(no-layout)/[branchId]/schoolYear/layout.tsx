import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function SchoolYearLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("school_admin");
  return children;
}
