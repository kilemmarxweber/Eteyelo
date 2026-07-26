import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

/** Layout serveur : support établissement (chef école, caissier, enseignant…). */
export default async function AssertSupportSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("support_settings");
  return children;
}
