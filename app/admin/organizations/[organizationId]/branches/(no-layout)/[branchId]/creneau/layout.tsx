import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function CreneauLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("vacation");
  return children;
}
