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

function teachingBranchFilter(branchId: string) {
  return {
    OR: [
      { branchId },
      { branchId: null, classe: { branchId } },
    ],
  };
}

/** Affectations actives (classe + cours) pour un enseignant — filtres & création. */
export async function listTeacherTeachingsForDevoirs(params: {
  branchId: string;
  teacherId: string;
  schoolYearId?: string;
}) {
  return prisma.teaching.findMany({
    where: {
      teacherId: params.teacherId,
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      AND: [teachingBranchFilter(params.branchId)],
      ...(params.schoolYearId ? { schoolYearId: params.schoolYearId } : {}),
    },
    select: {
      id: true,
      schoolYearId: true,
      teacherId: true,
      classeId: true,
      coursId: true,
      classe: { select: { id: true, nameClasse: true } },
      cours: { select: { id: true, nameCours: true } },
    },
    orderBy: [{ classe: { nameClasse: "asc" } }, { cours: { nameCours: "asc" } }],
  });
}

/**
 * Vérifie qu'un enseignant (non-admin) ne gère que ses propres devoirs.
 * Les admins passent sans restriction.
 */
export async function assertManageAssignmentOwnership(
  access: OnlineAssignmentAccess,
  assignment: { teacherId: string },
) {
  if (canManageOrganization(access.session)) return;
  const teacherId = await resolveTeacherIdForUser(
    access.userId,
    access.branchId,
    access.teacherId,
  );
  if (!teacherId || assignment.teacherId !== teacherId) {
    throw new Error("Accès refusé : ce devoir ne vous est pas affecté.");
  }
}

/**
 * Charge une affectation Teaching autorisée pour create/update.
 * Force le teacherId depuis la BDD (jamais celui du client pour les non-admins).
 */
export async function resolveOwnedTeachingForManage(
  access: OnlineAssignmentAccess,
  input: {
    teachingId: string;
    classId: string;
    courseId: string;
    schoolYearId?: string;
  },
) {
  const isAdmin = canManageOrganization(access.session);
  const teacherId = await resolveTeacherIdForUser(
    access.userId,
    access.branchId,
    access.teacherId,
  );

  if (!isAdmin && !teacherId) {
    throw new Error("Profil enseignant introuvable.");
  }

  const teaching = await prisma.teaching.findFirst({
    where: {
      id: input.teachingId,
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      AND: [teachingBranchFilter(access.branchId)],
      ...(!isAdmin && teacherId ? { teacherId } : {}),
    },
    select: {
      id: true,
      teacherId: true,
      classeId: true,
      coursId: true,
      schoolYearId: true,
    },
  });

  if (!teaching) {
    throw new Error(
      "Affectation cours/classe introuvable ou non autorisée.",
    );
  }
  if (teaching.classeId !== input.classId || teaching.coursId !== input.courseId) {
    throw new Error(
      "Le cours et la classe doivent correspondre à votre affectation.",
    );
  }
  if (input.schoolYearId && teaching.schoolYearId !== input.schoolYearId) {
    throw new Error(
      "L'affectation ne correspond pas à l'année scolaire sélectionnée.",
    );
  }

  return teaching;
}
