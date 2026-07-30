import { notFound } from "next/navigation";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  listAccessibleCursusStudents,
  resolveCursusViewerRole,
  type CursusViewerRole,
} from "@/lib/auth/cursus-scope";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { isSchoolBranch } from "@/lib/branch-capabilities";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type OnlineAssignmentMode = "manage" | "student" | "parent";

export type OnlineAssignmentAccess = {
  mode: OnlineAssignmentMode;
  role: CursusViewerRole;
  userId: string;
  organizationId: string;
  branchId: string;
  typebranch: unknown;
  teacherId: string | null;
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"];
};

/** Devoirs en ligne : uniquement Primaire / Secondaire, scopés à la branche active. */
export function isOnlineAssignmentsBranch(typebranch: unknown): boolean {
  return isSchoolBranch(typebranch);
}

export function canManageOnlineAssignments(session: unknown): boolean {
  return (
    canManageOrganization(session) ||
    hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER", "teacher"])
  );
}

export function canAccessOnlineAssignments(session: unknown): boolean {
  return (
    canManageOnlineAssignments(session) ||
    hasSessionRole(session, [
      ORG_ROLE.STUDENT,
      "STUDENT",
      "student",
    ])
  );
}

export async function enforceOnlineAssignmentAccess(): Promise<OnlineAssignmentAccess> {
  const ctx = await requireBranchContext();
  if (!isOnlineAssignmentsBranch(ctx.typebranch)) {
    notFound();
  }
  const branchId = ctx.branchId?.trim();
  if (!branchId) {
    notFound();
  }

  const role = resolveCursusViewerRole(ctx.session);
  if (!role || role === "parent" || !canAccessOnlineAssignments(ctx.session)) {
    notFound();
  }

  let mode: OnlineAssignmentMode = "manage";
  if (role === "student") mode = "student";
  else if (role === "parent") mode = "parent";
  else mode = "manage";

  const teacherId =
    (ctx.session as { teacherContext?: { teacherId?: string } | null })
      ?.teacherContext?.teacherId ?? null;

  return {
    mode,
    role,
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    branchId,
    typebranch: ctx.typebranch,
    teacherId,
    session: ctx.session,
  };
}

export async function enforceOnlineAssignmentManage() {
  const access = await enforceOnlineAssignmentAccess();
  if (access.mode !== "manage") notFound();
  return access;
}

export async function getAccessibleStudentsForOnline(
  access: OnlineAssignmentAccess,
) {
  return listAccessibleCursusStudents({
    role: access.role,
    userId: access.userId,
    branchId: access.branchId,
  });
}

export async function resolveTeacherIdForUser(
  userId: string,
  branchId: string,
  preferredTeacherId?: string | null,
) {
  if (preferredTeacherId) {
    const ok = await prisma.teacher.findFirst({
      where: {
        id: preferredTeacherId,
        branchMember: { branchId, member: { userId } },
      },
      select: { id: true },
    });
    if (ok) return ok.id;
  }
  const teacher = await prisma.teacher.findFirst({
    where: { branchMember: { branchId, member: { userId } } },
    select: { id: true },
  });
  return teacher?.id ?? null;
}
