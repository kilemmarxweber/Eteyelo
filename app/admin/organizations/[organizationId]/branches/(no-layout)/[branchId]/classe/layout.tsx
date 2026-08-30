import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function ClasseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("classe");
  return children;
}
