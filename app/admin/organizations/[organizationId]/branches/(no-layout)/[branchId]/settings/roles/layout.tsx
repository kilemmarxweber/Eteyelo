import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function RolesSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertBranchAreaAccess("roles_privileges");
  return children;
}
