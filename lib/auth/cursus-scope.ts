import { notFound } from "next/navigation";

import {
  canAccessNotesReadArea,
  canAccessResultsArea,
  canAccessScheduleReadArea,
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type CursusViewerRole = "admin" | "teacher" | "student" | "parent";

export type CursusStudentRef = {
  id: string;
  fullName: string;
  classId: string | null;
  className: string | null;
  classCode: string | null;
  schoolYearId: string | null;
};

function formatPersonName(user?: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  if (!user) return "—";
  return (
    [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim() ||
    "—"
  );
}

/**
 * Rôle cursus pour notes / horaire / résultats / fiches (unit-05 / unit-00 §3ter).
 */
export function resolveCursusViewerRole(session: unknown): CursusViewerRole | null {
  if (canManageOrganization(session)) return "admin";
  if (hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER", "teacher"])) {
    return "teacher";
  }
  if (hasSessionRole(session, [ORG_ROLE.STUDENT, "STUDENT", "student"])) {
    return "student";
  }
  if (hasSessionRole(session, [ORG_ROLE.PARENT, "PARENT", "parent"])) {
    return "parent";
  }
  return null;
}

export function isCursusSelfScopedRole(
  role: CursusViewerRole | null,
): role is "student" | "parent" {
  return role === "student" || role === "parent";
}

/**
 * Élèves accessibles en lecture cursus : soi (élève) ou enfants liés (parent).
 */
export async function listAccessibleCursusStudents(params: {
  role: CursusViewerRole;
  userId: string;
  branchId: string;
}): Promise<CursusStudentRef[]> {
  const { role, userId, branchId } = params;

  if (role === "student") {
    const student = await prisma.student.findFirst({
      where: {
        branchMember: {
          branchId,
          member: { userId },
        },
      },
      select: {
        id: true,
        branchMember: {
          select: {
            member: {
              select: {
                user: {
                  select: { name: true, postnom: true, prenom: true },
                },
              },
            },
          },
        },
        classEnrollment: {
          where: {
            branchId,
          },
          orderBy: [
            { schoolYear: { isCurrentYear: "desc" } },
            { createdAt: "desc" },
          ],
          take: 1,
          select: {
            schoolYearId: true,
            classe: {
              select: {
                id: true,
                nameClasse: true,
                codeClasse: true,
              },
            },
          },
        },
      },
    });

    if (!student) return [];

    const enrollment = student.classEnrollment[0];
    return [
      {
        id: student.id,
        fullName: formatPersonName(student.branchMember?.member?.user),
        classId: enrollment?.classe?.id ?? null,
        className: enrollment?.classe?.nameClasse ?? null,
        classCode: enrollment?.classe?.codeClasse ?? null,
        schoolYearId: enrollment?.schoolYearId ?? null,
      },
    ];
  }

  if (role === "parent") {
    const children = await prisma.student.findMany({
      where: {
        branchMember: { branchId },
        parent: {
          branchMember: {
            branchId,
            member: { userId },
          },
        },
      },
      select: {
        id: true,
        branchMember: {
          select: {
            member: {
              select: {
                user: {
                  select: { name: true, postnom: true, prenom: true },
                },
              },
            },
          },
        },
        classEnrollment: {
          where: {
            branchId,
          },
          orderBy: [
            { schoolYear: { isCurrentYear: "desc" } },
            { createdAt: "desc" },
          ],
          take: 1,
          select: {
            schoolYearId: true,
            classe: {
              select: {
                id: true,
                nameClasse: true,
                codeClasse: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return children.map((student) => {
      const enrollment = student.classEnrollment[0];
      return {
        id: student.id,
        fullName: formatPersonName(student.branchMember?.member?.user),
        classId: enrollment?.classe?.id ?? null,
        className: enrollment?.classe?.nameClasse ?? null,
        classCode: enrollment?.classe?.codeClasse ?? null,
        schoolYearId: enrollment?.schoolYearId ?? null,
      };
    });
  }

  return [];
}

/**
 * Résout l’élève cible pour une page cursus.
 * - Élève : force l’id session (ignore `?studentId=` alien).
 * - Parent : autorise seulement un enfant lié.
 */
export async function resolveScopedCursusStudent(params: {
  role: CursusViewerRole;
  userId: string;
  branchId: string;
  requestedStudentId?: string | null;
}): Promise<CursusStudentRef> {
  const accessible = await listAccessibleCursusStudents(params);

  if (!accessible.length) {
    notFound();
  }

  const requested = params.requestedStudentId?.trim() || null;

  if (params.role === "student") {
    const self = accessible[0];
    if (requested && requested !== self.id) {
      notFound();
    }
    return self;
  }

  if (params.role === "parent") {
    if (requested) {
      const match = accessible.find((s) => s.id === requested);
      if (!match) notFound();
      return match;
    }
    return accessible[0];
  }

  notFound();
}

export function assertStudentIdInScope(
  studentId: string | null | undefined,
  allowedIds: Iterable<string>,
): void {
  if (!studentId) {
    notFound();
  }
  const allowed = new Set(allowedIds);
  if (!allowed.has(studentId)) {
    notFound();
  }
}

/** Gate lecture notes (admin/teacher saisie OU student/parent lecture). */
export function enforceNotesAreaAccess(session: unknown): CursusViewerRole {
  if (!canAccessNotesReadArea(session)) {
    notFound();
  }
  const role = resolveCursusViewerRole(session);
  if (!role) notFound();
  return role;
}

/** Gate lecture horaire. */
export function enforceScheduleAreaAccess(session: unknown): CursusViewerRole {
  if (!canAccessScheduleReadArea(session)) {
    notFound();
  }
  const role = resolveCursusViewerRole(session);
  if (!role) notFound();
  return role;
}

/** Gate résultats / fiches personnelles. */
export function enforceResultsAreaAccess(session: unknown): CursusViewerRole {
  if (!canAccessResultsArea(session)) {
    notFound();
  }
  const role = resolveCursusViewerRole(session);
  if (!role) notFound();
  return role;
}
