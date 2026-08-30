"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  consumeAdminCreatedUserPlainPassword,
  stashAdminCreatedUserPlainPassword,
} from "@/lib/admin-created-user-password";
import {
  assignBranchMemberCycles,
  buildBranchMemberDirectoryWhere,
  classeCycleWhere,
  isCycleGlobalRole,
  primaryOrgRoleFromSession,
  resolveAccessibleCycles,
  sessionCanViewAllDirectoryUsers,
} from "@/lib/auth/cycle-scope";
import {
  canManageOrganization,
  getSessionRoles,
  hasSessionRole,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";
import { generateSecurePassword } from "@/lib/generate-password";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getConfiguredCoursIdsForClasse } from "@/lib/course-ponderation";
import { syncTeacherDossierExperienceYears } from "@/lib/teacher-assignment-years";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { requireCurrentSchoolYear } from "@/lib/school-year";
import { action } from "@/lib/zsa";
import { createOrganizationMemberAction } from "../../../../members/actions";
import {
  deleteTeacherSchema,
  ITeacher,
  teacherSchema,
} from "@/src/interfaces/Teacher";
import { ensureActiveBranchMember } from "@/lib/branch-member-status";
import {
  deactivateTeacherProfile,
  ensurePersonnelOnTeacherBranchMember,
} from "@/lib/dual-staff-profile";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getBranchCycles,
  isSchoolCycle,
  resolveCycle,
  type SchoolCycle,
} from "@/lib/cycle";

async function syncTeacherTitulaire(input: {
  branchId: string;
  teacherId: string;
  estTitulaire?: boolean;
  classeId?: string;
  coursId?: string;
}) {
  const schoolYear = await requireCurrentSchoolYear(input.branchId);

  // Retire le statut titulaire de cet enseignant pour l'année en cours.
  await prisma.teaching.updateMany({
    where: {
      branchId: input.branchId,
      teacherId: input.teacherId,
      schoolYearId: schoolYear.id,
      titulaire: true,
    },
    data: { titulaire: false },
  });

  if (!input.estTitulaire || !input.classeId || !input.coursId) {
    return;
  }

  const [classe, cours] = await Promise.all([
    prisma.classe.findFirst({
      where: { id: input.classeId, branchId: input.branchId },
      select: { id: true, optionId: true, level: true },
    }),
    prisma.cours.findFirst({
      where: { id: input.coursId, branchId: input.branchId },
      select: { id: true },
    }),
  ]);

  if (!classe) {
    throw new Error("Classe introuvable dans cette branche");
  }
  if (!cours) {
    throw new Error("Cours introuvable dans cette branche");
  }

  const configuredIds = await getConfiguredCoursIdsForClasse({
    branchId: input.branchId,
    optionId: classe.optionId,
    level: classe.level,
  });
  if (!configuredIds.includes(input.coursId)) {
    throw new Error(
      "Ce cours n'a pas de pondération pour cette classe. Configurez d'abord les pondérations.",
    );
  }

  // Un seul titulaire par classe / année.
  await prisma.teaching.updateMany({
    where: {
      branchId: input.branchId,
      classeId: input.classeId,
      schoolYearId: schoolYear.id,
      titulaire: true,
    },
    data: { titulaire: false },
  });

  const existing = await prisma.teaching.findFirst({
    where: {
      classeId: input.classeId,
      schoolYearId: schoolYear.id,
      coursId: input.coursId,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.teaching.update({
      where: { id: existing.id },
      data: {
        teacherId: input.teacherId,
        statusTeaching: true,
        titulaire: true,
        branchId: input.branchId,
      },
    });
  } else {
    await prisma.teaching.create({
      data: {
        branchId: input.branchId,
        teacherId: input.teacherId,
        classeId: input.classeId,
        schoolYearId: schoolYear.id,
        coursId: input.coursId,
        statusTeaching: true,
        titulaire: true,
      },
    });
  }

  await syncTeacherDossierExperienceYears({
    teacherId: input.teacherId,
    branchId: input.branchId,
  });
}

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
    canPurgePermanently: isOrganizationOwnerSession(session, branchMember?.role),
    isTeacher: hasSessionRole(
      session,
      [ORG_ROLE.TEACHER, "TEACHER"],
      branchMember?.role,
    ),
  };
}

async function getBranchTypeContext(branchId: string, organizationId: string) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: {
      typebranch: true,
      cycles: {
        where: { isActive: true },
        select: { cycle: true, isActive: true, sortOrder: true },
      },
    },
  });
  if (!branch) {
    throw new Error("Branche introuvable");
  }
  return {
    typebranch: branch.typebranch,
    schoolCycles: getBranchCycles(branch).filter(isSchoolCycle),
  };
}

function classeWhereForCycles(
  branchId: string,
  organizationId: string,
  cycles: SchoolCycle[],
) {
  if (cycles.length === 0) {
    return { branchId, branch: { organizationId }, id: "__none__" };
  }
  return {
    branchId,
    branch: { organizationId },
    ...classeCycleWhere(cycles),
  };
}

function uniqueNames(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
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
        dateOfBirth: input.dateOfBirth,
        image: input.image?.trim() || undefined,
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

      const branchMemberId = await ensureActiveBranchMember({
        memberId: result.memberId,
        branchId,
        role: "TEACHER",
      });

      await assignBranchMemberCycles({
        branchMemberId,
        branchId,
        orgRole: "teacher",
        cycles: input.cycles,
      });

      let teacher = await prisma.teacher.findUnique({
        where: { branchMemberId },
      });
      if (!teacher) {
        teacher = await prisma.teacher.create({
          data: {
            branchMemberId,
          },
        });
      }

      if (input.estTitulaire && input.classeId && input.coursId) {
        await syncTeacherTitulaire({
          branchId,
          teacherId: teacher.id,
          estTitulaire: true,
          classeId: input.classeId,
          coursId: input.coursId,
        });
      }

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
      select: {
        id: true,
        branchMemberId: true,
      },
    });

    if (!teacher?.branchMemberId) {
      return {
        success: false,
        message: "Enseignant introuvable",
      };
    }

    try {
      const result = await deactivateTeacherProfile({
        teacherId: teacher.id,
        branchMemberId: teacher.branchMemberId,
      });

      return {
        success: true,
        message: result.keptBranchActive
          ? "Enseignant désactivé. Le profil personnel reste actif dans cette branche."
          : "Enseignant désactivé dans cette branche. L'historique est conservé.",
      };
    } catch (error) {
      return {
        success: false,
        message:
          errMessage(error) || "Erreur lors de la désactivation de l'enseignant",
      };
    }
  });

/** Désactive dans la branche — historique conservé, membre org intact. */
export const deleteTeacherPermanentlyAction = action
  .input(deleteTeacherSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, canManageTeachers } =
      await getCurrentBranch();

    if (!canManageTeachers) {
      return {
        ok: false as const,
        message: "Action non autorisée",
      };
    }

    try {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: input.id,
          branchMember: { branchId },
        },
        select: { id: true, branchMemberId: true },
      });

      if (!teacher?.branchMemberId) {
        return {
          ok: false as const,
          message: "Enseignant introuvable",
        };
      }

      const result = await deactivateTeacherProfile({
        teacherId: teacher.id,
        branchMemberId: teacher.branchMemberId,
      });
      revalidatePath(
        `/admin/organizations/${organizationId}/branches/${branchId}/teacher`,
      );
      revalidatePath(
        `/admin/organizations/${organizationId}/branches/${branchId}/personnel`,
      );
      return {
        ok: true as const,
        message: result.keptBranchActive
          ? "Enseignant désactivé. Le profil personnel reste actif ; l'historique est conservé."
          : "Enseignant désactivé dans cette branche. Il reste membre de l'organisation ; l'historique est conservé.",
      };
    } catch (error: unknown) {
      return {
        ok: false as const,
        message:
          errMessage(error) || "Erreur lors de la désactivation de l'enseignant",
      };
    }
  });

/** @deprecated Utiliser archiveTeacherAction */
export const deleteTeacherAction = archiveTeacherAction;

/** Ajoute (ou réactive) le profil Personnel sur un enseignant existant. */
export const makeTeacherAlsoPersonnelAction = action
  .input(
    z.object({
      teacherId: z.string().min(1),
      orgRole: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, canManageTeachers } =
      await getCurrentBranch();

    if (!canManageTeachers) {
      return { ok: false as const, message: "Action non autorisée" };
    }

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: input.teacherId,
        isActive: true,
        branchMember: { branchId, isActive: true },
      },
      select: {
        id: true,
        branchMemberId: true,
        branchMember: {
          select: {
            memberId: true,
            personel: { select: { id: true, isActive: true } },
          },
        },
      },
    });

    if (!teacher?.branchMemberId || !teacher.branchMember?.memberId) {
      return { ok: false as const, message: "Enseignant introuvable" };
    }

    const existingPersonnel = teacher.branchMember.personel?.[0];
    if (existingPersonnel?.isActive) {
      return {
        ok: false as const,
        message: "Cet enseignant est déjà aussi personnel",
      };
    }

    try {
      await ensurePersonnelOnTeacherBranchMember({
        branchMemberId: teacher.branchMemberId,
        memberId: teacher.branchMember.memberId,
        orgRole: input.orgRole,
      });
      revalidatePath(
        `/admin/organizations/${organizationId}/branches/${branchId}/teacher`,
      );
      revalidatePath(
        `/admin/organizations/${organizationId}/branches/${branchId}/personnel`,
      );
      return {
        ok: true as const,
        message:
          "Profil personnel ajouté. La personne est désormais enseignant et personnel.",
      };
    } catch (error) {
      return {
        ok: false as const,
        message: errMessage(error) || "Impossible d'ajouter le profil personnel",
      };
    }
  });

export const getTeachersAction = action.handler(
  async (): Promise<ITeacher[]> => {
    const {
      branchId,
      organizationId,
      userId: sessionUserId,
      canManageTeachers,
      isTeacher,
      branchMemberId,
    } = await getCurrentBranch();

    if (!canManageTeachers && !isTeacher) {
      return [];
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const orgMember = await prisma.member.findFirst({
      where: { userId: sessionUserId, organizationId },
      select: { role: true },
    });
    const seeAll = sessionCanViewAllDirectoryUsers(session, orgMember?.role);
    const seeWholeBranch =
      !seeAll && isCycleGlobalRole(orgMember?.role);
    const directoryWhere = await buildBranchMemberDirectoryWhere({
      viewerBranchMemberId: branchMemberId,
      seeAll,
      seeWholeBranch,
    });

    const { typebranch } = await getBranchTypeContext(branchId, organizationId);

    const teachers = await prisma.teacher.findMany({
      where: {
        isActive: true,
        branchMember: {
          AND: [
            {
              branchId,
              isActive: true,
              member: {
                organizationId,
                ...(canManageTeachers ? {} : { userId: sessionUserId }),
              },
            },
            ...(directoryWhere ? [directoryWhere] : []),
          ],
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
            memberCycles: { select: { cycle: true } },
            personel: { select: { id: true, isActive: true } },
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
            titulaire: true,
            classeId: true,
            coursId: true,
            classe: { select: { id: true, nameClasse: true, cycle: true } },
            cours: { select: { id: true, nameCours: true } },
          },
        },
      },
    });

    return teachers.map((teacher) => {
      const user = teacher.branchMember?.member?.user;
      const titulaireTeaching = teacher.teaching.find(
        (item) => item.titulaire === true,
      );
      const cycleAssignmentCount: Record<string, number> = {};
      const classesByCycle: Record<string, string[]> = {};
      const coursesByCycle: Record<string, string[]> = {};
      const alsoPersonnel = (teacher.branchMember?.personel ?? []).some(
        (row) => row.isActive,
      );

      for (const item of teacher.teaching) {
        const cycle = resolveCycle(item.classe, { typebranch });
        cycleAssignmentCount[cycle] = (cycleAssignmentCount[cycle] ?? 0) + 1;
        if (item.classe?.nameClasse) {
          (classesByCycle[cycle] ??= []).push(item.classe.nameClasse);
        }
        if (item.cours?.nameCours) {
          (coursesByCycle[cycle] ??= []).push(item.cours.nameCours);
        }
      }

      for (const cycle of Object.keys(classesByCycle)) {
        classesByCycle[cycle] = uniqueNames(classesByCycle[cycle]);
      }
      for (const cycle of Object.keys(coursesByCycle)) {
        coursesByCycle[cycle] = uniqueNames(coursesByCycle[cycle]);
      }

      const classNames = uniqueNames(
        teacher.teaching
          .map((item) => item.classe?.nameClasse)
          .filter((name): name is string => Boolean(name)),
      );
      const courseNames = uniqueNames(
        teacher.teaching
          .map((item) => item.cours?.nameCours)
          .filter((name): name is string => Boolean(name)),
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
        statusUser: teacher.isActive && (teacher.branchMember?.isActive ?? true),
        alsoPersonnel,
        createdAt: teacher.createdAt,
        updatedAt: teacher.updatedAt,
        address: user?.address || "",
        image: user?.image || "",
        assignmentStatus:
          teacher.teaching.length > 0
            ? ("assigned" as const)
            : ("unassigned" as const),
        assignmentCount: teacher.teaching.length,
        classCount: classNames.length,
        courseCount: courseNames.length,
        classNames,
        courseNames,
        assignmentCycles: Object.keys(cycleAssignmentCount),
        cycleAssignmentCount,
        classesByCycle,
        coursesByCycle,
        estTitulaire: Boolean(titulaireTeaching),
        classeId: titulaireTeaching?.classeId ?? "",
        coursId: titulaireTeaching?.coursId ?? "",
        cycles: (teacher.branchMember?.memberCycles ?? []).map(
          (row) => row.cycle,
        ),
      };
    });
  },
);

export const getTeacherDashboardStatsAction = action
  .input(
    z
      .object({
        cycle: z.enum(["MATERNELLE", "PRIMAIRE", "SECONDAIRE"]).optional(),
      })
      .optional(),
  )
  .handler(async ({ input }) => {
    const {
      branchId,
      organizationId,
      userId,
      canManageTeachers,
      isTeacher,
      branchMemberId,
    } = await getCurrentBranch();

    if (!canManageTeachers && !isTeacher) {
      throw new Error("Action non autorisee");
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const orgMember = await prisma.member.findFirst({
      where: { userId, organizationId },
      select: { role: true },
    });
    const seeAll = sessionCanViewAllDirectoryUsers(session, orgMember?.role);
    const seeWholeBranch = !seeAll && isCycleGlobalRole(orgMember?.role);
    const directoryWhere = await buildBranchMemberDirectoryWhere({
      viewerBranchMemberId: branchMemberId,
      seeAll,
      seeWholeBranch,
    });

    const { schoolCycles } = await getBranchTypeContext(
      branchId,
      organizationId,
    );
    const accessibleCycles = (
      await resolveAccessibleCycles({
        branchId,
        branchMemberId,
        orgRole: primaryOrgRoleFromSession(session, orgMember?.role),
      })
    ).filter(isSchoolCycle);
    const visibleCycles = schoolCycles.filter((cycle) =>
      accessibleCycles.includes(cycle),
    );
    const requestedCycle = input?.cycle;
    if (requestedCycle && !visibleCycles.includes(requestedCycle)) {
      throw new Error("Cycle non autorisé");
    }
    const scopedCycles = requestedCycle ? [requestedCycle] : visibleCycles;

    const activeTeachingWhere = {
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      schoolYear: {
        branchId,
        isCurrentYear: true,
        isArchived: false,
        branch: { organizationId },
      },
      classe: classeWhereForCycles(branchId, organizationId, scopedCycles),
      cours: { branchId, branch: { organizationId } },
    };
    const teacherScope = {
      isActive: true as const,
      branchMember: {
        AND: [
          {
            branchId,
            isActive: true,
            member: {
              organizationId,
              ...(canManageTeachers ? {} : { userId }),
            },
          },
          ...(directoryWhere ? [directoryWhere] : []),
        ],
      },
    };

    const assignedWhere = {
      ...teacherScope,
      teaching: { some: activeTeachingWhere },
    };

    const [
      totalActive,
      assigned,
      totalAssignments,
      coveredClassRows,
      coveredCourseRows,
    ] = await Promise.all([
      prisma.teacher.count({
        where: requestedCycle ? assignedWhere : teacherScope,
      }),
      prisma.teacher.count({ where: assignedWhere }),
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
      cycles: visibleCycles,
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
        ...(userData.image?.trim() ? { image: userData.image.trim() } : {}),
      },
    });

    if (canManageTeachers) {
      await syncTeacherTitulaire({
        branchId,
        teacherId: teacher.id,
        estTitulaire: Boolean(input.estTitulaire),
        classeId: input.classeId,
        coursId: input.coursId,
      });

      if (teacher.branchMemberId) {
        await assignBranchMemberCycles({
          branchMemberId: teacher.branchMemberId,
          branchId,
          orgRole: "teacher",
          cycles: input.cycles,
        });
      }
    }

    return {
      ok: true,
      message: "Enseignant mis a jour avec succes",
      teacherId: teacher.id,
      user,
    };
  });

const updateTeacherPhotoSchema = z.object({
  teacherId: z.string().min(1),
  imageUrl: z.string().min(1).max(2000),
});

export const updateTeacherPhotoAction = action
  .input(updateTeacherPhotoSchema)
  .handler(async ({ input }) => {
    const {
      branchId,
      organizationId,
      userId: sessionUserId,
      canManageTeachers,
      isTeacher,
    } =
      await getCurrentBranch();

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: input.teacherId,
        branchMember: {
          branchId,
          ...(canManageTeachers
            ? {}
            : { member: { userId: sessionUserId } }),
        },
      },
      select: {
        branchMember: {
          select: {
            member: {
              select: { userId: true, user: { select: { image: true } } },
            },
          },
        },
      },
    });

    const userId = teacher?.branchMember?.member?.userId;
    if (!userId) {
      throw new Error("Enseignant introuvable dans cette branche");
    }
    if (!canManageTeachers && !isTeacher) {
      return { ok: false as const, message: "Action non autorisee" };
    }

    const hadPhoto = Boolean(
      teacher.branchMember?.member?.user?.image?.trim(),
    );
    await prisma.user.update({
      where: { id: userId },
      data: { image: input.imageUrl.trim() },
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/teacher/${input.teacherId}`,
    );
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/teacher`,
    );

    return {
      ok: true as const,
      message: hadPhoto
        ? "Photo mise a jour avec succes"
        : "Photo ajoutee avec succes",
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
