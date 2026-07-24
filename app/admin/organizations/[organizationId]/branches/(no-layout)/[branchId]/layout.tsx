import ClientLayout from "./client-layout";
import AttendanceGuard from "./attendance/component/AttendanceGuard ";
import { enforceOrganizationBranchPage } from "@/lib/auth/require-organization-permission";
import { switchActiveBranch } from "@/lib/auth/switch-branch";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  const context = await enforceOrganizationBranchPage(organizationId, branchId);

  // Un seul guard ; skip DB write si déjà sur cette branche.
  const switched = await switchActiveBranch(organizationId, branchId, {
    alreadyGuarded: true,
    appRole: context.appRole,
  });
  if (!switched.ok) {
    console.error("[BranchLayout] switchActiveBranch:", switched.message);
  }

  return (
    <ClientLayout>
      <AttendanceGuard />
      {children}
    </ClientLayout>
  );
}
