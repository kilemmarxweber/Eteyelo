import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

/** Layout serveur pour settings org avancés (unit-09). */
export default async function AssertBranchOrgSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("branch_org_settings");
  return children;
}
