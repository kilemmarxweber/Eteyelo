import { enforceOrganizationListPage } from "@/lib/auth/require-organization-permission";
import { OrganizationsView } from "./organizations-view";

export default async function AdminOrganizationsPage() {
  await enforceOrganizationListPage();
  return <OrganizationsView />;
}
