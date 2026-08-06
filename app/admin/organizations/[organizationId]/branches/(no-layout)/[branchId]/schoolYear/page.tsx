import { redirect } from "next/navigation";

/** Ancienne route : l’année scolaire est désormais dans Paramètres. */
export default async function SchoolYearsRedirect({
  params,
}: {
  params: Promise<{
    organizationId: string;
    branchId: string;
  }>;
}) {
  const { organizationId, branchId } = await params;
  redirect(
    `/admin/organizations/${organizationId}/branches/${branchId}/settings/annee-scolaire`,
  );
}
