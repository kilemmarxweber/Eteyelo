import { NewDevoirClient } from "../new-devoir-client";

export const dynamic = "force-dynamic";

export default async function NewDevoirPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  return (
    <NewDevoirClient organizationId={organizationId} branchId={branchId} />
  );
}
