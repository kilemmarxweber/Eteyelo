import { redirect } from "next/navigation";

export default async function SettingsAccount({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  redirect(
    `/admin/organizations/${organizationId}/branches/${branchId}/settings`,
  );
}
