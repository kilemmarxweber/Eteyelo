import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

import FraisClient from "./components/fraisClient";

export default async function Page({
  params,
}: {
  params: Promise<{ classeId: string }>;
}) {
  const { classeId } = await params;
  const { session } = await requireBranchContext();
  await assertBranchAreaAccess("finance", session);

  return <FraisClient classeId={classeId} />;
}
