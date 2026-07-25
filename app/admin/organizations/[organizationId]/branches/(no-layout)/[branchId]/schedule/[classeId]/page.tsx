import { notFound } from "next/navigation";
import { IconCalendarTime } from "@tabler/icons-react";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  enforceScheduleAreaAccess,
  isCursusSelfScopedRole,
} from "@/lib/auth/cursus-scope";
import {
  canAccessTeachingArea,
  canManageOrganization,
} from "@/lib/auth/session-roles";
import ScheduleEditorClient from "./schedule-editor-client";

export const dynamic = "force-dynamic";

export default async function ScheduleClassePage({
  params,
}: {
  params: Promise<{ classeId: string }>;
}) {
  const { classeId } = await params;
  const { session } = await requireBranchContext();
  const role = enforceScheduleAreaAccess(session);

  // Élève / parent : pas d'horaire d'une autre classe via URL (unit-05).
  if (
    isCursusSelfScopedRole(role) ||
    (!canManageOrganization(session) && !canAccessTeachingArea(session))
  ) {
    notFound();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconCalendarTime size={18} />
        <span className="text-sm">
          Planifiez l&apos;horaire de la semaine (lundi à samedi) dans une seule
          grille
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ScheduleEditorClient classeId={classeId} />
      </div>
    </div>
  );
}
