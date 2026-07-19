"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  consumeAdminCreatedUserPlainPassword,
  stashAdminCreatedUserPlainPassword,
} from "@/lib/admin-created-user-password";
import {
  canManageOrganization,
  getSessionRoles,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { generateSecurePassword } from "@/lib/generate-password";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { action } from "@/lib/zsa";
import { createOrganizationMemberAction } from "../../../../members/actions";
import {
  deleteTeacherSchema,
  ITeacher,
  teacherSchema,
} from "@/src/interfaces/Teacher";

export async function getCurrentBranch() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const branchId = session?.session?.activeBranchId;
  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId;

  if (!session?.user?.id || !branchId || !organizationId) {
    throw new Error("Aucune branche active");
  }

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId,
      member: {
        userId: session.user.id,
        organizationId,
      },
    },
    select: {
      id: true,
      role: true,
    },
  });
  const roles = getSessionRoles(session, branchMember?.role);

  return {
    branchId,
    organizationId,
    userId: session.user.id,
    roles,
    branchMemberId: branchMember?.id ?? null,
    canManageTeachers: canManageOrganization(session, branchMember?.role),
    isTeacher: hasSessionRole(
      session,
      [ORG_ROLE.TEACHER, "TEACHER"],
      branchMember?.role,
    ),
  };
}

function errMessage(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Une erreur est survenue.";
}

function isValidEmail(email: string | null | undefined): email is string {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getAvailableUsername(username: string): Promise<string> {
  let candidate = username;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${username}-${suffix}`;
  }

  return candidate;
}

export const createTeacherAction = action
  .input(teacherSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, canManageTeachers } =
      await getCurrentBranch();

    if (!canManageTeachers) {
      return {
        ok: false,
        message: "Action non autorisee",
      };
    }

    const count = await prisma.teacher.count();
    const emailLower = isValidEmail(input.email)
      ? input.email.toLowerCase()
      : `teacher.${input.prenom.toLowerCase()}.${count + 1}@gmail.com`;
    const username = await getAvailableUsername(input.username);
    const password = generateSecurePassword(16);

    stashAdminCreatedUserPlainPassword(emailLower, password);

    let userId: string | null = null;

    try {
      const result = await createOrganizationMemberAction({
        name: input.nom,
        prenom: input.prenom,
        postnom: input.postnom,
        sexe: input.sexe,
        telephone: input.telephone,
        email: emailLower,
        address: input.address,
        dateOfBirth: input.dateOfBirth ?? new Date(),
        organizationId,
        branchId,
        orgRole: "teacher",
      });

      if (!result.ok) {
        consumeAdminCreatedUserPlainPassword(emailLower);
        return {
          ok: false,
          message: result.message,
        };
      }

      userId = result.userId;

      await prisma.user.update({
        where: { id: userId },
        data: { username },
      });

      const branchMember = await prisma.branchMember.create({
        data: {
          memberId: result.memberId,
          branchId,
          role: "TEACHER",
        },
      });

      const teacher = await prisma.teacher.create({
        data: {
          branchMemberId: branchMember.id,
        },
      });

      return {
        ok: true,
        teacher,
      };
    } catch (e) {
      consumeAdminCreatedUserPlainPassword(emailLower);

      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }

      return {
        ok: false,
        message: errMessage(e),
      };
    }
  });

export const archiveTeacherAction = action
  .input(deleteTeacherSchema)
  .handler(async ({ input }) => {
    const { branchId, canManageTeachers } = await getCurrentBranch();

    if (!canManageTeachers) {
      return {
        success: false,
        message: "Action non autorisee",
      };
    }

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: input.id,
        branchMember: {
          branchId,
        },
      },
      include: {
        branchMember: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      return {
        success: false,
        message: "Enseignant introuvable",
      };
    }

    try {
      const userId = teacher.branchMember?.member?.user?.id;

      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { statusUser: false },
        });
      }

      return {
        success: true,
        message: "Enseignant archivé avec succès",
      };
    } catch (error) {
      return {
        success: false,
        message:
          errMessage(error) || "Erreur lors de l'archivage de l'enseignant",
      };
    }
  });

/** @deprecated Utiliser archiveTeacherAction */
export const deleteTeacherAction = archiveTeacherAction;

export const getTeachersAction = action.handler(
  async (): Promise<ITeacher[]> => {
    const {
      branchId,
      organizationId,
      userId: sessionUserId,
      canManageTeachers,
      isTeacher,
    } = await getCurrentBranch();

    if (!canManageTeachers && !isTeacher) {
      return [];
    }

    const teachers = await prisma.teacher.findMany({
      where: {
        branchMember: {
          branchId,
          member: {
            organizationId,
            ...(canManageTeachers ? {} : { userId: sessionUserId }),
          },
        },
      },
      include: {
        branchMember: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
          },
        },
        teaching: {
          where: {
            OR: [{ statusTeaching: true }, { statusTeaching: null }],
            schoolYear: {
              branchId,
              isCurrentYear: true,
              isArchived: false,
              branch: { organizationId },
            },
            classe: { branchId, branch: { organizationId } },
            cours: { branchId, branch: { organizationId } },
          },
          select: {
            id: true,
            classe: { select: { id: true, nameClasse: true } },
            cours: { select: { id: true, nameCours: true } },
          },
        },
      },
    });

    return teachers.map((teacher) => {
      const user = teacher.branchMember?.member?.user;
      const classNames = Array.from(
        new Set(
          teacher.teaching
            .map((item) => item.classe?.nameClasse)
            .filter((name): name is string => Boolean(name)),
        ),
      );
      const courseNames = Array.from(
        new Set(
          teacher.teaching
            .map((item) => item.cours?.nameCours)
            .filter((name): name is string => Boolean(name)),
        ),
      );

      return {
        id: teacher.id,
        teacherId: teacher.id,
        memberId: teacher.branchMember?.memberId ?? "",
        userId: user?.id ?? "",
        nom: user?.name || "",
        postnom: user?.postnom || "",
        prenom: user?.prenom || "",
        dateOfBirth: user?.dateOfBirth || new Date(),
        sexe: user?.sexe || "",
        email: user?.email || "",
        username: user?.username || "",
        telephone: user?.telephone || "",
        statusUser: user?.statusUser ?? true,
        createdAt: teacher.createdAt,
        updatedAt: teacher.updatedAt,
        address: user?.address || "",
        assignmentStatus:
          teacher.teaching.length > 0
            ? ("assigned" as const)
            : ("unassigned" as const),
        assignmentCount: teacher.teaching.length,
        classCount: classNames.length,
        courseCount: courseNames.length,
        classNames,
        courseNames,
      };
    });
  },
);

export const getTeacherDashboardStatsAction = action.handler(async () => {
  const {
    branchId,
    organizationId,
    userId,
    canManageTeachers,
    isTeacher,
  } =
    await getCurrentBranch();

  if (!canManageTeachers && !isTeacher) {
    throw new Error("Action non autorisee");
  }

  const activeTeachingWhere = {
    OR: [{ statusTeaching: true }, { statusTeaching: null }],
    schoolYear: {
      branchId,
      isCurrentYear: true,
      isArchived: false,
      branch: { organizationId },
    },
    classe: { branchId, branch: { organizationId } },
    cours: { branchId, branch: { organizationId } },
  };
  const teacherScope = {
    branchMember: {
      branchId,
      member: {
        organizationId,
        ...(canManageTeachers ? {} : { userId }),
        user: {
          OR: [{ statusUser: true }, { statusUser: null }],
        },
      },
    },
  };

  const [
    totalActive,
    assigned,
    totalAssignments,
    coveredClassRows,
    coveredCourseRows,
  ] =
    await Promise.all([
      prisma.teacher.count({ where: teacherScope }),
      prisma.teacher.count({
        where: {
          ...teacherScope,
          teaching: { some: activeTeachingWhere },
        },
      }),
      prisma.teaching.count({
        where: {
          ...activeTeachingWhere,
          teacher: teacherScope,
        },
      }),
      prisma.teaching.groupBy({
        by: ["classeId"],
        where: {
          ...activeTeachingWhere,
          teacher: teacherScope,
        },
      }),
      prisma.teaching.groupBy({
        by: ["coursId"],
        where: {
          ...activeTeachingWhere,
          teacher: teacherScope,
        },
      }),
    ]);

  return {
    totalActive,
    assigned,
    unassigned: Math.max(0, totalActive - assigned),
    totalAssignments,
    coveredClasses: coveredClassRows.length,
    coveredCourses: coveredCourseRows.length,
    averageAssignments: assigned
      ? Number((totalAssignments / assigned).toFixed(1))
      : 0,
  };
});

export const updateTeacherAction = action
  .input(teacherSchema)
  .handler(async ({ input }) => {
    const { branchId, userId: sessionUserId, canManageTeachers, isTeacher } =
      await getCurrentBranch();
    const { teacherId, ...userData } = input;

    if (!teacherId) {
      throw new Error("Teacher ID manquant");
    }

    if (!canManageTeachers && !isTeacher) {
      throw new Error("Action non autorisee");
    }

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        branchMember: {
          branchId,
          ...(canManageTeachers
            ? {}
            : {
                member: {
                  userId: sessionUserId,
                },
              }),
        },
      },
      include: {
        branchMember: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      throw new Error("Enseignant introuvable");
    }

    const linkedUserId = teacher.branchMember?.member?.user?.id;

    if (!linkedUserId) {
      throw new Error("User lie introuvable");
    }

    const sexeMap: Record<string, "M" | "F"> = {
      masculin: "M",
      feminin: "F",
      M: "M",
      F: "F",
    };

    const user = await prisma.user.update({
      where: { id: linkedUserId },
      data: {
        username: userData.username,
        email: userData.email || undefined,
        name: userData.nom,
        postnom: userData.postnom,
        prenom: userData.prenom,
        dateOfBirth: userData.dateOfBirth,
        sexe: userData.sexe ? sexeMap[userData.sexe] : undefined,
        telephone: userData.telephone,
        address: userData.address,
      },
    });

    return {
      ok: true,
      message: "Enseignant mis a jour avec succes",
      teacherId: teacher.id,
      user,
    };
  });

export const getTeacherReportContextAction = action.handler(async () => {
  const { branchId, organizationId, canManageTeachers, isTeacher } =
    await getCurrentBranch();

  if (!canManageTeachers && !isTeacher) {
    throw new Error("Action non autorisee");
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: schoolReportBranchSelect,
  });

  if (!branch) throw new Error("Branche active introuvable");

  return buildSchoolReportContext(branch);
});
