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
    classeKey?: string;
    tab?: string;
  }>;
};

export default async function OrganizationRapportPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId } = await params;
  const { branchId, scope, schoolYearKey, classeKey, tab } = await searchParams;

  const data = await loadOrganizationReports({
    organizationId,
    branchId,
    scope,
    schoolYearKey,
    classeKey,
    tab,
  });

  return <RapportDashboard organizationId={organizationId} data={data} />;
}
