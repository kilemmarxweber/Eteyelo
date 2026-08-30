import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function FinalistesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("finalistes");
  return children;
}
