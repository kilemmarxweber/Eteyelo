import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function ResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("results");
  return children;
}
