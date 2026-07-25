import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("hr_directory");
  return children;
}
