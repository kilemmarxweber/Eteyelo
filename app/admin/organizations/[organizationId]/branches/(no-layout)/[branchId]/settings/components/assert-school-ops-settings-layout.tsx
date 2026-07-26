import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

/** Layout serveur : communication publique + calendrier scolaire. */
export default async function AssertSchoolOpsSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("school_ops_settings");
  return children;
}
