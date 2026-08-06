import SchoolYearSettingsClient from "./school-year-settings-client";

export default async function AnneeScolaireSettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { branchId } = await params;
  return <SchoolYearSettingsClient branchId={branchId} />;
}
