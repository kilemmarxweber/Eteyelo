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
  await enforceOrganizationBranchPage(organizationId, branchId);

  // Active la branche sur la session (owner plateforme sans membership inclus).
  const switched = await switchActiveBranch(organizationId, branchId);
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
