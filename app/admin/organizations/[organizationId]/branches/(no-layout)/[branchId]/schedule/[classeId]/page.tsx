import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { IconCalendarTime } from "@tabler/icons-react";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { prisma } from "@/lib/prisma";
import {
  enforceScheduleAreaAccess,
  isCursusSelfScopedRole,
} from "@/lib/auth/cursus-scope";
import { assertClassRosterAccess } from "@/lib/auth/data-scope";
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
  const { session, userId, branchId, organizationId } = await requireBranchContext({
    onMissing: "redirect",
  });
  const role = enforceScheduleAreaAccess(session);

  // Élève / parent : pas d'horaire d'une autre classe via URL (unit-05).
  if (
    isCursusSelfScopedRole(role) ||
    (!canManageOrganization(session) && !canAccessTeachingArea(session))
  ) {
    notFound();
  }

  // Enseignant : uniquement les classes où il donne cours.
  await assertClassRosterAccess({
    session,
    userId,
    branchId,
    classId: classeId,
  });

  const classe = await prisma.classe.findFirst({
    where: {
      id: classeId,
      branchId,
      branch: { organizationId },
    },
    select: { id: true },
  });

  if (!classe) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/schedule`,
    );
  }

  const isTeacherViewer = !canManageOrganization(session);
  const t = await getTranslations("teaching.schedule");

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconCalendarTime size={18} />
        <span className="text-sm">
          {isTeacherViewer ? t("teacherViewDesc") : t("editorDesc")}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ScheduleEditorClient classeId={classeId} />
      </div>
    </div>
  );
}
