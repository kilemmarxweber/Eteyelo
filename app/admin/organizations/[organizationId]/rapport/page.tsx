import { getOrganizationReportData } from "./rapport.action";
import { RapportDashboard } from "./rapport-dashboard";

type PageProps = {
  params: Promise<{
    organizationId: string;
  }>;
  searchParams: Promise<{
    branchId?: string;
  }>;
};

export default async function OrganizationRapportPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId } = await params;
  const { branchId } = await searchParams;

  const data = await getOrganizationReportData({
    organizationId,
    branchId,
  });

  return <RapportDashboard organizationId={organizationId} data={data} />;
}
