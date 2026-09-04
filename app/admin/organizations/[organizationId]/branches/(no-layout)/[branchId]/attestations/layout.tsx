import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function DocumentsAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("documents");
  return children;
}
