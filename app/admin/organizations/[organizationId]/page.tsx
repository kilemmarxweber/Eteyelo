import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import { getOrganizationAccessAction } from "@/app/admin/organizations/actions";
import { notFound } from "next/navigation";
import { OrganizationHomeView } from "./organization-home-view";

export default async function AdminOrganizationHomePage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);

  const access = await getOrganizationAccessAction(organizationId);
  if (!access) {
    notFound();
  }

  return <OrganizationHomeView />;
}