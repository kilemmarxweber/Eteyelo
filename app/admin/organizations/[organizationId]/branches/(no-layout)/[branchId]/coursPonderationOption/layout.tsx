import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function CoursPonderationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("ponderations");
  return children;
}
