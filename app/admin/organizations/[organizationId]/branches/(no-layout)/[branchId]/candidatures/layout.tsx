import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function CandidaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("candidatures");
  return children;
}
