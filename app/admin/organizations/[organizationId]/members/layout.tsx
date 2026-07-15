import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";

export default async function OrganizationManagerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);
  return children;
}
