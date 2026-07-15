import { enforceOrganizationPartenairesPage } from "@/lib/auth/require-organization-permission";

export default async function OrganizationPartnersLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await enforceOrganizationPartenairesPage(organizationId);
  return children;
}
