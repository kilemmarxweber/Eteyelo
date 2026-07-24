import { loadOrganizationReports } from "./rapport.action";
import { RapportDashboard } from "./rapport-dashboard";

type PageProps = {
  params: Promise<{
    organizationId: string;
  }>;
  searchParams: Promise<{
    branchId?: string;
    scope?: string;
    schoolYearKey?: string;
    tab?: string;
  }>;
};

export default async function OrganizationRapportPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId } = await params;
  const { branchId, scope, schoolYearKey, tab } = await searchParams;

  const data = await loadOrganizationReports({
    organizationId,
    branchId,
    scope,
    schoolYearKey,
    tab,
  });

  return <RapportDashboard organizationId={organizationId} data={data} />;
}
