import { notFound } from "next/navigation";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessTeachingArea } from "@/lib/auth/session-roles";

import FraisClient from "./components/fraisClient";

export default async function Page({
  params,
}: {
  params: Promise<{ classeId: string }>;
}) {
  const { classeId } = await params;
  const { session } = await requireBranchContext();

  if (!canAccessTeachingArea(session)) {
    notFound();
  }

  return <FraisClient classeId={classeId} />;
}
