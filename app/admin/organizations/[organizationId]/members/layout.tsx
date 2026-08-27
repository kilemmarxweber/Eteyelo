import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import { isRestrictedGestionnaire } from "@/lib/auth/role-labels";
import { notFound } from "next/navigation";

export default async function OrganizationManagerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const context = await enforceOrganizationManagerPage(organizationId);
  if (isRestrictedGestionnaire(context.appRole, context.membership?.role)) {
    notFound();
  }
  return children;
}
