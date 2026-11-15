import ClientLayout from "./client-layout";
import AttendanceGuard from "./attendance/component/AttendanceGuard";
import { enforceOrganizationBranchPage } from "@/lib/auth/require-organization-permission";
import { switchActiveBranch } from "@/lib/auth/switch-branch";
import { resolveBranchUiLocale } from "@/lib/branch-locale";
import { loadMessages } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

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

  // Toujours lire en DB : la session peut être stale juste après Apparence.
  const branchLocaleRow = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: { locale: true, educationSystem: true },
  });

  // Langue de CETTE branche uniquement (défaut CONGOLAIS→fr / ANGOLAIS→pt).
  const locale = resolveBranchUiLocale(branchLocaleRow ?? {});
  const messages = await loadMessages(locale);

  return (
    <ClientLayout locale={locale} messages={messages}>
      <AttendanceGuard />
      {children}
    </ClientLayout>
  );
}
