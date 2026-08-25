import ClientLayout from "./client-layout";
import AttendanceGuard from "./attendance/component/AttendanceGuard";
import { enforceOrganizationBranchPage } from "@/lib/auth/require-organization-permission";
import { switchActiveBranch } from "@/lib/auth/switch-branch";
import { loadMessages } from "@/lib/i18n";
import { resolvePreferredLocale } from "@/lib/resolve-preferred-locale";

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

  const locale = await resolvePreferredLocale(
    (context.session.user as { locale?: string | null }).locale,
  );
  const messages = await loadMessages(locale);

  return (
    <ClientLayout locale={locale} messages={messages}>
      <AttendanceGuard />
      {children}
    </ClientLayout>
  );
}
