import { redirect } from "next/navigation";
import ClientLayout from "./client-layout";
import AttendanceGuard from "./attendance/component/AttendanceGuard ";
import { IdleLogout } from "@/lib/idle-logout";
import { enforceOrganizationBranchPage } from "@/lib/auth/require-organization-permission";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  await enforceOrganizationBranchPage(organizationId, branchId);

  return (
    <ClientLayout>
      <IdleLogout />
      <AttendanceGuard />
      {children}
    </ClientLayout>
  );
}
