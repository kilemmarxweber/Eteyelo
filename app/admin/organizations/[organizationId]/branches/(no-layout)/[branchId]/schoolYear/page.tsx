import SchoolYearsClient from "./components/SchoolYearsClient";

export default async function SchoolYears({
  params,
}: {
  params: Promise<{
    organizationId: string;
    branchId: string;
  }>;
}) {
  const { branchId } = await params;

  return <SchoolYearsClient branchId={branchId} />;
}
