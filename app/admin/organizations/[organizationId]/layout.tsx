import { OrganizationSectionClient } from "./organization-section-client";
import { enforceOrganizationSectionAccess } from "@/lib/auth/require-organization-permission";

export default async function OrganizationSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await enforceOrganizationSectionAccess(organizationId);

  return (
    <OrganizationSectionClient organizationId={organizationId}>
      {children}
    </OrganizationSectionClient>
  );
}
