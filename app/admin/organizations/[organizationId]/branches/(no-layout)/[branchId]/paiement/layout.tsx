import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function PaiementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("finance");
  return children;
}
