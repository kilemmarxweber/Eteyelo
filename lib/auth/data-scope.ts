import { notFound } from "next/navigation";

import {
  assertStudentIdInScope,
  listAccessibleCursusStudents,
  resolveCursusViewerRole,
  type CursusViewerRole,
} from "@/lib/auth/cursus-scope";
import {
  canAccessTeachingArea,
  canAccessTitulaireFichesArea,
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export { assertStudentIdInScope };

/**
 * Accès liste élèves / fiches d’une classe (unit-10).
 * Managers : OK. Enseignant : uniquement classes où il a un teaching actif.
 */
export async function assertClassRosterAccess(params: {
  session: unknown;
  userId: string;
  branchId: string;
  classId: string;
}): Promise<void> {
  const { session, userId, branchId, classId } = params;

  if (!canAccessTeachingArea(session)) {
    notFound();
  }

  if (canManageOrganization(session)) {
    return;
  }

  const teaching = await prisma.teaching.findFirst({
    where: {
      classeId: classId,
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      AND: [
        {
          OR: [
            { branchId },
            { branchId: null, classe: { branchId } },
          ],
        },
      ],
      teacher: {
        branchMember: {
          branchId,
          member: { userId },
        },
      },
    },
    select: { id: true },
  });

  if (!teaching) {
    notFound();
  }
}

/**
 * Accès fiche centrale / bulletin classe : manager ou titulaire de la classe.
 */
export async function assertTitulaireClassAccess(params: {
  session: unknown;
  userId: string;
  branchId: string;
  classId: string;
}): Promise<void> {
  const { session, userId, branchId, classId } = params;

  if (!canAccessTitulaireFichesArea(session)) {
    notFound();
  }

  if (canManageOrganization(session)) {
    return;
  }

  const teaching = await prisma.teaching.findFirst({
    where: {
      classeId: classId,
      titulaire: true,
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      AND: [
        {
          OR: [
            { branchId },
            { branchId: null, classe: { branchId } },
          ],
        },
      ],
      teacher: {
        branchMember: {
          branchId,
          member: { userId },
        },
      },
    },
    select: { id: true },
  });

  if (!teaching) {
    notFound();
  }
}

/**
 * Lecture présence / profil : soi, parent lié, manager, ou enseignant affecté.
 */
export async function assertStudentReadableInBranch(params: {
  session: unknown;
  userId: string;
  branchId: string;
  studentId: string;
}): Promise<void> {
  const { session, userId, branchId, studentId } = params;

  if (canManageOrganization(session)) {
    const exists = await prisma.student.findFirst({
      where: { id: studentId, branchMember: { branchId } },
      select: { id: true },
    });
    if (!exists) notFound();
    return;
  }

  const role = resolveCursusViewerRole(session);
  if (role === "student" || role === "parent") {
    const accessible = await listAccessibleCursusStudents({
      role,
      userId,
      branchId,
    });
    assertStudentIdInScope(studentId, accessible.map((s) => s.id));
    return;
  }

  if (hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"])) {
    const teaching = await prisma.teaching.findFirst({
      where: {
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
        AND: [
          {
            OR: [
              { branchId },
              { branchId: null, classe: { branchId } },
            ],
          },
        ],
        teacher: {
          branchMember: {
            branchId,
            member: { userId },
          },
        },
        classe: {
          branchId,
          classEnrollment: {
            some: {
              branchId,
              studentId,
              schoolYear: { isCurrentYear: true, branchId },
            },
          },
        },
      },
      select: { id: true },
    });
    if (!teaching) notFound();
    return;
  }

  notFound();
}

/**
 * Marquage présence : manager, ou enseignant propriétaire de la session.
 */
export async function assertAttendanceSessionWriteAccess(params: {
  session: unknown;
  userId: string;
  branchId: string;
  sessionId: string;
}): Promise<void> {
  const { session, userId, branchId, sessionId } = params;

  if (!canAccessTeachingArea(session)) {
    notFound();
  }

  if (canManageOrganization(session)) {
    return;
  }

  const attendanceSession = await prisma.attendanceSession.findFirst({
    where: {
      id: sessionId,
      branchId,
      teaching: {
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
        teacher: {
          branchMember: {
            branchId,
            member: { userId },
          },
        },
      },
    },
    select: { id: true },
  });

  if (!attendanceSession) {
    notFound();
  }
}

/** IDs élèves autorisés pour un rôle cursus self-scoped (élève / parent). */
export async function getSelfScopedStudentIds(params: {
  role: CursusViewerRole;
  userId: string;
  branchId: string;
}): Promise<Set<string>> {
  if (params.role !== "student" && params.role !== "parent") {
    return new Set();
  }
  const accessible = await listAccessibleCursusStudents(params);
  return new Set(accessible.map((s) => s.id));
}
