import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function OptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("options");
  return children;
}
