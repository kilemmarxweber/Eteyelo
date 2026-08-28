import { notFound } from "next/navigation";

import {
  assertStudentIdInScope,
  listAccessibleCursusStudents,
  resolveCursusViewerRole,
  type CursusViewerRole,
} from "@/lib/auth/cursus-scope";
import { listTeacherScheduleCandidates } from "@/lib/attendance-teacher-session";
import {
  canAccessStudentDirectory,
  canAccessTeachingArea,
  canAccessTitulaireFichesArea,
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export { assertStudentIdInScope };

function teachingBranchFilter(branchId: string) {
  return {
    OR: [
      { branchId },
      { branchId: null, classe: { branchId } },
    ],
  };
}

export async function getTeacherIdForUser(
  userId: string,
  branchId: string,
): Promise<string | null> {
  const teacher = await prisma.teacher.findFirst({
    where: {
      branchMember: {
        branchId,
        member: { userId },
      },
    },
    select: { id: true },
  });
  return teacher?.id ?? null;
}

export async function getPersonnelIdForUser(
  userId: string,
  branchId: string,
): Promise<string | null> {
  const personnel = await prisma.personnel.findFirst({
    where: {
      branchMember: {
        branchId,
        member: { userId },
      },
    },
    select: { id: true },
  });
  return personnel?.id ?? null;
}

export async function getTeacherAssignedTeachingIds(
  userId: string,
  branchId: string,
): Promise<string[]> {
  const rows = await prisma.teaching.findMany({
    where: {
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      AND: [teachingBranchFilter(branchId)],
      teacher: {
        branchMember: {
          branchId,
          member: { userId },
        },
      },
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function getTeacherAssignedClassIds(
  userId: string,
  branchId: string,
): Promise<string[]> {
  const rows = await prisma.teaching.findMany({
    where: {
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      AND: [teachingBranchFilter(branchId)],
      teacher: {
        branchMember: {
          branchId,
          member: { userId },
        },
      },
    },
    select: { classeId: true },
    distinct: ["classeId"],
  });
  return rows.map((row) => row.classeId);
}

/** Scope lecture présence pour un enseignant (non-manager). */
export async function getTeacherAttendanceReadScope(params: {
  session: unknown;
  userId: string;
  branchId: string;
}): Promise<{ teacherId: string; teachingIds: string[]; classIds: string[] } | null> {
  if (canManageOrganization(params.session)) {
    return null;
  }

  if (!hasSessionRole(params.session, [ORG_ROLE.TEACHER, "TEACHER"])) {
    return null;
  }

  const teacherId = await getTeacherIdForUser(params.userId, params.branchId);
  if (!teacherId) return null;

  const [teachingIds, classIds] = await Promise.all([
    getTeacherAssignedTeachingIds(params.userId, params.branchId),
    getTeacherAssignedClassIds(params.userId, params.branchId),
  ]);

  return { teacherId, teachingIds, classIds };
}

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
 * Lecture présence / profil : soi, parent lié, annuaire élèves (admin + caissier),
 * ou enseignant affecté.
 */
export async function assertStudentReadableInBranch(params: {
  session: unknown;
  userId: string;
  branchId: string;
  studentId: string;
}): Promise<void> {
  const { session, userId, branchId, studentId } = params;

  // School admin + caissier : lecture fiche / présence (sans CRUD).
  if (canAccessStudentDirectory(session)) {
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
 * Marquage présence session (legacy UI) : manager, ou enseignant propriétaire.
 * Préférer `assertStudentAttendanceWriteAccess` pour les writes élèves.
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

/**
 * Pointage élève multi-acteurs (pas de self élève) :
 * - manager / préfet / directeur : session de la branche
 * - enseignant : teaching à lui + fenêtre horaire + élève de la classe
 */
export async function assertStudentAttendanceWriteAccess(params: {
  session: unknown;
  userId: string;
  branchId: string;
  sessionId: string;
  studentId: string;
}): Promise<void> {
  const { session, userId, branchId, sessionId, studentId } = params;

  const attendanceSession = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, branchId },
    select: {
      id: true,
      teachingId: true,
      teaching: {
        select: {
          teacherId: true,
          classeId: true,
        },
      },
    },
  });

  if (!attendanceSession?.teaching) {
    throw new Error("Session de presence introuvable.");
  }

  if (canManageOrganization(session)) {
    return;
  }

  if (hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"])) {
    const teacherId = await getTeacherIdForUser(userId, branchId);
    if (!teacherId || attendanceSession.teaching.teacherId !== teacherId) {
      throw new Error(
        "Vous ne pouvez pointer que les eleves de vos cours assignes.",
      );
    }

    const candidates = await listTeacherScheduleCandidates(teacherId, branchId);
    if (
      !candidates.some(
        (candidate) => candidate.teachingId === attendanceSession.teachingId,
      )
    ) {
      throw new Error(
        "Pointage possible uniquement autour de l'heure de votre cours.",
      );
    }

    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        studentId,
        classeId: attendanceSession.teaching.classeId,
        branchId,
        schoolYear: { isCurrentYear: true, branchId },
      },
      select: { id: true },
    });

    if (!enrollment) {
      throw new Error("Cet eleve n'appartient pas a la classe de ce cours.");
    }
    return;
  }

  throw new Error("Acces non autorise pour ce pointage eleve.");
}

/**
 * Self-pointage enseignant (ou manager qui marque un enseignant).
 * Enseignant : soi uniquement + session de son teaching dans la fenêtre.
 */
export async function assertTeacherAttendanceWriteAccess(params: {
  session: unknown;
  userId: string;
  branchId: string;
  sessionId: string;
  teacherId: string;
}): Promise<void> {
  const { session, userId, branchId, sessionId, teacherId } = params;

  const attendanceSession = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, branchId },
    select: {
      id: true,
      teachingId: true,
      teaching: { select: { teacherId: true } },
    },
  });

  if (!attendanceSession?.teaching) {
    throw new Error("Session de presence introuvable.");
  }

  if (canManageOrganization(session)) {
    return;
  }

  if (!hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"])) {
    throw new Error("Acces non autorise pour ce pointage enseignant.");
  }

  const selfTeacherId = await getTeacherIdForUser(userId, branchId);
  if (!selfTeacherId || selfTeacherId !== teacherId) {
    throw new Error("Vous ne pouvez pointer que votre propre presence.");
  }

  if (attendanceSession.teaching.teacherId !== selfTeacherId) {
    throw new Error("Cette session ne vous appartient pas.");
  }

  const candidates = await listTeacherScheduleCandidates(
    selfTeacherId,
    branchId,
  );
  if (
    !candidates.some(
      (candidate) => candidate.teachingId === attendanceSession.teachingId,
    )
  ) {
    throw new Error(
      "Pointage possible uniquement autour de l'heure de votre cours.",
    );
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
