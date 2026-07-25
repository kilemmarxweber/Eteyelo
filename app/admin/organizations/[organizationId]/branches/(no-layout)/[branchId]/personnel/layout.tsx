import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function PersonnelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("hr_directory");
  return children;
}
