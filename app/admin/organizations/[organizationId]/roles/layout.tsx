import { enforceOrganizationOwnerPage } from "@/lib/auth/require-organization-permission";

export default async function OrganizationRolesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await enforceOrganizationOwnerPage(organizationId);
  return children;
}
