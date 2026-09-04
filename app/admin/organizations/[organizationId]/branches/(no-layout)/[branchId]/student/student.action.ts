"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import {
  IStudent,
  studentSchema,
  deleteStudentSchema,
} from "@/src/interfaces/Student";
import { StudentCategory } from "@/prisma/generated/prisma/client";
import {
  canAccessStudentDirectory,
  getSessionRoles,
  hasSessionRole,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import {
  consumeAdminCreatedUserPlainPassword,
  stashAdminCreatedUserPlainPassword,
} from "@/lib/admin-created-user-password";
import { createOrganizationMemberAction } from "../../../../members/actions";
import { generateSecurePassword } from "@/lib/generate-password";
import {
  canCreateStudentInBranch,
  isCentreFormationBranch,
  isUniversiteBranch,
  requiresStudentImport,
} from "@/lib/branch-capabilities";
import { buildStudentAccessWhere } from "@/lib/atelier-student-access";
import { resolveStudentParentId } from "@/lib/centre-default-parent";
import { canIssueBranchDocuments } from "@/lib/branch-document-permissions";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getBranchAreaMutationFlags } from "@/lib/auth/assert-branch-area-access";
import {
  classeCycleWhere,
  primaryOrgRoleFromSession,
  resolveAccessibleCycles,
} from "@/lib/auth/cycle-scope";
import { z } from "zod";
import {
  familyExtraInfoSchema,
  familyExtraToDb,
  studentExtraInfoSchema,
  studentExtraToDb,
} from "@/lib/registration-extra-info";
import { deactivatePersonInBranch, ensureActiveBranchMember } from "@/lib/branch-member-status";
import { purgeStudentPermanently } from "@/lib/purge-branch-person";
import { isExamCodesClass } from "@/lib/exam-export-meta";

export async function getCurrentBranch() {
  const { branchId, organizationId, userId, typebranch, educationSystem, session } =
    await requireBranchContext();

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId,
      member: {
        userId,
        organizationId,
      },
    },
    select: {
      id: true,
      role: true,
    },
  });
  const roles = getSessionRoles(session, branchMember?.role);
  const mutationFlags = await getBranchAreaMutationFlags(
    "students",
    session,
    organizationId,
    branchId,
    [branchMember?.role],
  );

  return {
    branchId,
    organizationId,
    userId,
    typebranch,
    educationSystem,
    session,
    branchMemberId: branchMember?.id ?? null,
    branchMemberRole: branchMember?.role ?? null,
    roles,
    canCreateStudents: mutationFlags.canCreate,
    canUpdateStudents: mutationFlags.canUpdate,
    canDeleteStudents: mutationFlags.canDelete,
    canManageStudents: mutationFlags.canWrite,
    canPurgePermanently: isOrganizationOwnerSession(session, branchMember?.role),
    canReadStudents: canAccessStudentDirectory(session, branchMember?.role),
    canIssueDocuments: canIssueBranchDocuments(session, branchMember?.role),
    isParent: hasSessionRole(
      session,
      [ORG_ROLE.PARENT, "PARENT"],
      branchMember?.role,
    ),
    isStudent: hasSessionRole(
      session,
      [ORG_ROLE.STUDENT, "STUDENT"],
      branchMember?.role,
    ),
    isTeacher: hasSessionRole(
      session,
      [ORG_ROLE.TEACHER, "TEACHER"],
      branchMember?.role,
    ),
  };
}
/* ======================================================
   SAFE CATEGORY HELPER ✅
====================================================== */
function parseCategory(category?: string | null): StudentCategory {
  if (!category) return StudentCategory.NORMAL;

  if (Object.values(StudentCategory).includes(category as StudentCategory)) {
    return category as StudentCategory;
  }

  return StudentCategory.NORMAL;
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

async function getAvailableUsername(username: string): Promise<string> {
  let candidate = username;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${username}-${suffix}`;
  }

  return candidate;
}

function revalidateStudentPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/student`);
}

/* ======================================================
   CREATE
====================================================== */
export const createStudentAction = action
  .input(studentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, canCreateStudents, typebranch } =
      await getCurrentBranch();
    if (!canCreateStudents) {
      return {
        ok: false,
        message: "Action non autorisee",
      };
    }

    if (!canCreateStudentInBranch(typebranch)) {
      return {
        ok: false,
        message:
          "Les eleves d'atelier doivent etre importes depuis une branche scolaire de l'organisation.",
      };
    }

    const parentId = await resolveStudentParentId({
      typebranch,
      branchId,
      organizationId,
      branchName: (
        await prisma.branch.findUnique({
          where: { id: branchId },
          select: { name: true },
        })
      )?.name,
      requestedParentId: input.parentId,
    });
    const { category, orgRole, email, telephone, placeOfBirth, ...data } = input;

    //const emailLower = data.email?.toLowerCase() ?? "";
    const count = await prisma.student.count();
    const generatedEmail = `student.${input.prenom.toLowerCase()}.${count + 1}@gmail.com`;
    const emailLower = generatedEmail.toLowerCase();
    const password = generateSecurePassword(16);
    const username = await getAvailableUsername(input.username);

    stashAdminCreatedUserPlainPassword(emailLower, password);

    let userId: string | null = null;

    try {
      // =========================
      // 1. CREATE ORG MEMBER
      // =========================
      const result = await createOrganizationMemberAction({
        ...data,
        organizationId,
        branchId,
        orgRole: "student",
        email: emailLower,
        telephone: "+243000000000",
      });
      if (!result.ok) {
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

      // =========================
      // 2. CREATE / RÉACTIVER BRANCH MEMBER
      // =========================
      const branchMemberId = await ensureActiveBranchMember({
        memberId: result.memberId,
        branchId,
        role: "STUDENT",
      });

      // =========================
      // 3. CREATE STUDENT (si besoin)
      // =========================
      let student = await prisma.student.findUnique({
        where: { branchMemberId },
      });
      if (!student) {
        student = await prisma.student.create({
          data: {
            branchMemberId,
            parentId,
            category: parseCategory(category),
            placeOfBirth: placeOfBirth || null,
            statusStudent: true,
          },
        });
      } else {
        student = await prisma.student.update({
          where: { id: student.id },
          data: {
            parentId,
            category: parseCategory(category),
            placeOfBirth: placeOfBirth || null,
            statusStudent: true,
          },
        });
      }

      revalidateStudentPages(organizationId, branchId);
      return {
        ok: true,
        student,
      };
    } catch (e) {
      consumeAdminCreatedUserPlainPassword(emailLower);

      if (userId) {
        await prisma.user
          .delete({
            where: {
              id: userId,
            },
          })
          .catch(() => {});
      }

      return {
        ok: false,
        message: errMessage(e),
      };
    }
  });
/* ======================================================
   GET ALL
====================================================== */
function mapStudentRecord(
  student: {
    id: string;
    category: StudentCategory;
    placeOfBirth: string | null;
    nationalite: string | null;
    autreNationalite: string | null;
    territoireAutreNationalite: string | null;
    langue: string | null;
    createdAt: Date;
    updatedAt: Date;
    branchMember: {
      memberId: string;
      isActive?: boolean | null;
      member: {
        user: {
          id: string;
          name: string;
          postnom: string | null;
          prenom: string | null;
          dateOfBirth: Date | null;
          sexe: string | null;
          email: string | null;
          username: string | null;
          telephone: string | null;
          statusUser: boolean | null;
          address: string | null;
          image: string | null;
        } | null;
      };
      branch?: { id: string; name: string } | null;
    };
    parent: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      nomMere: string | null;
      professionMere: string | null;
      tuteurNom: string | null;
      adresseTuteur: string | null;
      provinceOrigine: string | null;
      territoireOrigine: string | null;
      secteurOrigine: string | null;
      villageOrigine: string | null;
      branchMember: {
        memberId: string;
        member: { user: {
          id: string;
          name: string;
          postnom: string | null;
          prenom: string | null;
          dateOfBirth: Date | null;
          sexe: string | null;
          email: string | null;
          username: string | null;
          telephone: string | null;
          statusUser: boolean | null;
          address: string | null;
          image: string | null;
        } | null };
      } | null;
    };
    classEnrollment: Array<{
      createdAt?: Date;
      e13?: string | null;
      e80?: string | null;
      classe: {
        codeClasse: string;
        nameClasse: string;
        level?: string | null;
        cycle?: string | null;
      } | null;
      schoolYear?: {
        id: string;
        nameYear: string;
        isCurrentYear: boolean;
        startYear?: Date;
      } | null;
    }>;
  },
  extras?: {
    sourceBranchName?: string | null;
    sourceBranchId?: string | null;
    isLinkedStudent?: boolean;
  },
): IStudent {
  const user = student.branchMember?.member?.user;
  const parentUser = student.parent.branchMember?.member.user;
  const enrollments = (student.classEnrollment ?? [])
    .map((enrollment) => {
      const year = enrollment.schoolYear;
      if (!year?.id) return null;
      return {
        schoolYearId: year.id,
        schoolYearName: year.nameYear,
        isCurrentYear: year.isCurrentYear,
        classCode: enrollment.classe?.codeClasse ?? null,
        className: enrollment.classe?.nameClasse ?? null,
        classLevel: enrollment.classe?.level ?? null,
        classCycle: enrollment.classe?.cycle ?? null,
        e13: enrollment.e13 ?? null,
        e80: enrollment.e80 ?? null,
        createdAt: enrollment.createdAt ?? null,
      };
    })
    .filter(
      (
        enrollment,
      ): enrollment is {
        schoolYearId: string;
        schoolYearName: string;
        isCurrentYear: boolean;
        classCode: string | null;
        className: string | null;
        classLevel: string | null;
        classCycle: string | null;
        e13: string | null;
        e80: string | null;
        createdAt: Date | null;
      } => Boolean(enrollment),
    );

  const preferredEnrollment =
    enrollments.find((enrollment) => enrollment.isCurrentYear) ??
    enrollments[0] ??
    null;

  return {
    id: student.id,
    nom: user?.name || "",
    postnom: user?.postnom || "",
    prenom: user?.prenom || "",
    dateOfBirth: user?.dateOfBirth || new Date(),
    sexe: user?.sexe || "",
    email: user?.email || "",
    username: user?.username || "",
    telephone: user?.telephone || "",
    image: user?.image?.trim() || undefined,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    statusUser: student.branchMember?.isActive ?? user?.statusUser ?? true,
    address: user?.address || "",
    category: student.category || "NORMAL",
    placeOfBirth: student.placeOfBirth,
    nationalite: student.nationalite,
    autreNationalite: student.autreNationalite,
    territoireAutreNationalite: student.territoireAutreNationalite,
    langue: student.langue,
    classCode: preferredEnrollment?.classCode ?? null,
    className: preferredEnrollment?.className ?? null,
    classLevel: preferredEnrollment?.classLevel ?? null,
    classCycle: preferredEnrollment?.classCycle ?? null,
    schoolYearId: preferredEnrollment?.schoolYearId ?? null,
    schoolYearName: preferredEnrollment?.schoolYearName ?? null,
    e13: preferredEnrollment?.e13 ?? null,
    e80: preferredEnrollment?.e80 ?? null,
    enrollmentYearIds: enrollments.map((enrollment) => enrollment.schoolYearId),
    enrollments: enrollments.map((enrollment) => ({
      schoolYearId: enrollment.schoolYearId,
      schoolYearName: enrollment.schoolYearName,
      classCode: enrollment.classCode,
      className: enrollment.className,
      classLevel: enrollment.classLevel,
      classCycle: enrollment.classCycle,
      e13: enrollment.e13,
      e80: enrollment.e80,
      createdAt: enrollment.createdAt,
    })),
    memberId: student.branchMember?.memberId ?? "",
    userId: student.branchMember?.member?.user?.id ?? "",
    sourceBranchName: extras?.sourceBranchName ?? null,
    sourceBranchId: extras?.sourceBranchId ?? null,
    isLinkedStudent: extras?.isLinkedStudent ?? false,
    parent: student.parent
      ? {
          id: student.parent.id,
          memberId: student.parent.branchMember?.memberId ?? "",
          userId: parentUser?.id ?? "",
          nom: parentUser?.name || "",
          postnom: parentUser?.postnom || "",
          prenom: parentUser?.prenom || "",
          dateOfBirth: parentUser?.dateOfBirth || new Date(),
          sexe: parentUser?.sexe || "",
          email: parentUser?.email || "",
          username: parentUser?.username || "",
          telephone: parentUser?.telephone || "",
          createdAt: student.parent.createdAt,
          updatedAt: student.parent.updatedAt,
          statusUser: parentUser?.statusUser ?? true,
          address: parentUser?.address || "",
          nomMere: student.parent.nomMere,
          professionMere: student.parent.professionMere,
          tuteurNom: student.parent.tuteurNom,
          adresseTuteur: student.parent.adresseTuteur,
          provinceOrigine: student.parent.provinceOrigine,
          territoireOrigine: student.parent.territoireOrigine,
          secteurOrigine: student.parent.secteurOrigine,
          villageOrigine: student.parent.villageOrigine,
          students: null,
        }
      : undefined,
  };
}

const classEnrollmentListInclude = {
  where: {
    statusEnrollment: true,
  },
  include: {
    classe: true,
    schoolYear: {
      select: {
        id: true,
        nameYear: true,
        isCurrentYear: true,
        startYear: true,
      },
    },
  },
  orderBy: {
    schoolYear: {
      startYear: "desc" as const,
    },
  },
} as const;

function classEnrollmentForBranch(branchId: string) {
  return {
    ...classEnrollmentListInclude,
    where: {
      ...classEnrollmentListInclude.where,
      branchId,
    },
  };
}

const studentListInclude = {
  branchMember: {
    include: {
      member: {
        include: {
          user: true,
        },
      },
      branch: { select: { id: true, name: true } },
    },
  },
  parent: {
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
  },
  classEnrollment: classEnrollmentListInclude,
} as const;

export const getStudentsAction = action.handler(
  async (): Promise<IStudent[]> => {
    const {
      branchId,
      organizationId,
      branchMemberId,
      branchMemberRole,
      canManageStudents,
      canReadStudents,
      isParent,
      isStudent,
      isTeacher,
      typebranch,
      userId,
      session,
    } = await getCurrentBranch();

    const canListAllStudents = canManageStudents || canReadStudents;

    const orgMember = await prisma.member.findFirst({
      where: { userId, organizationId },
      select: { role: true },
    });
    const accessibleCycles = await resolveAccessibleCycles({
      branchId,
      branchMemberId,
      orgRole: primaryOrgRoleFromSession(
        session,
        orgMember?.role ?? branchMemberRole,
      ),
    });
    const classScope = classeCycleWhere(accessibleCycles);
    const enrollmentInAccessibleCycle = {
      some: {
        branchId,
        statusEnrollment: true,
        schoolYear: { isCurrentYear: true, isArchived: false },
        classe: classScope,
      },
    };

    if (requiresStudentImport(typebranch)) {
      const links = await prisma.studentBranchLink.findMany({
        where: {
          targetBranchId: branchId,
          isActive: true,
          student: { classEnrollment: enrollmentInAccessibleCycle },
        },
        include: {
          sourceBranch: { select: { id: true, name: true } },
          student: {
            include: {
              ...studentListInclude,
              classEnrollment: classEnrollmentForBranch(branchId),
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      });

      return links.map((link) =>
        mapStudentRecord(link.student, {
          sourceBranchName: link.sourceBranch.name,
          sourceBranchId: link.sourceBranch.id,
          isLinkedStudent: true,
        }),
      );
    }

    if (isCentreFormationBranch(typebranch) || isUniversiteBranch(typebranch)) {
      const [nativeStudents, links] = await Promise.all([
        prisma.student.findMany({
          where: canListAllStudents
            ? {
                branchMember: {
                  branchId,
                  isActive: true,
                  member: { organizationId },
                },
                classEnrollment: enrollmentInAccessibleCycle,
              }
            : { id: "__no_student_access__" },
          include: {
            ...studentListInclude,
            classEnrollment: classEnrollmentForBranch(branchId),
          },
        }),
        prisma.studentBranchLink.findMany({
          where: {
            targetBranchId: branchId,
            isActive: true,
            student: { classEnrollment: enrollmentInAccessibleCycle },
          },
          include: {
            sourceBranch: { select: { id: true, name: true } },
            student: {
              include: {
                ...studentListInclude,
                classEnrollment: classEnrollmentForBranch(branchId),
              },
            },
          },
        }),
      ]);

      const merged = new Map<string, IStudent>();

      for (const student of nativeStudents) {
        merged.set(student.id, mapStudentRecord(student));
      }

      for (const link of links) {
        merged.set(
          link.student.id,
          mapStudentRecord(link.student, {
            sourceBranchName: link.sourceBranch.name,
            sourceBranchId: link.sourceBranch.id,
            isLinkedStudent: true,
          }),
        );
      }

      return Array.from(merged.values());
    }

    const baseWhere = buildStudentAccessWhere(branchId, organizationId);

    const students = await prisma.student.findMany({
      where: canListAllStudents
        ? {
            ...baseWhere,
            classEnrollment: enrollmentInAccessibleCycle,
          }
        : isParent && branchMemberId
          ? {
              ...baseWhere,
              parent: {
                branchMemberId,
              },
            }
          : isStudent && branchMemberId
            ? {
                ...baseWhere,
                branchMemberId,
              }
            : isTeacher && branchMemberId
              ? {
                  ...baseWhere,
                  classEnrollment: {
                    some: {
                      branchId,
                      statusEnrollment: true,
                      schoolYear: { isCurrentYear: true, isArchived: false },
                      classe: {
                        ...classScope,
                        teaching: {
                          some: {
                            OR: [{ branchId }, { branchId: null }],
                            teacher: {
                              branchMemberId,
                            },
                          },
                        },
                      },
                    },
                  },
                }
              : {
                  ...baseWhere,
                  id: "__no_student_access__",
                },
      include: {
        ...studentListInclude,
        classEnrollment: classEnrollmentForBranch(branchId),
      },
    });

    return students.map((student) => mapStudentRecord(student));
  },
);

export const getStudentReportContextAction = action.handler(async () => {
  const { branchId, organizationId } = await getCurrentBranch();
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: schoolReportBranchSelect,
  });

  if (!branch) throw new Error("Branche active introuvable");

  return buildSchoolReportContext(branch);
});

/* ======================================================
   UPDATE
====================================================== */
export const updateStudentAction = action
  .input(studentSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, organizationId, canUpdateStudents } = await getCurrentBranch();
      if (!canUpdateStudents) {
        return {
          ok: false,
          message: "Action non autorisee",
        };
      }

      const { category, parentId, studentId, placeOfBirth, ...rest } = input;

      if (!studentId) throw new Error("ID manquant");

      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          parent: true,
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

      if (!student) {
        throw new Error("Étudiant introuvable");
      }

      const linkedInBranch = await prisma.studentBranchLink.findFirst({
        where: {
          studentId: student.id,
          targetBranchId: branchId,
          isActive: true,
        },
        select: { id: true },
      });

      if (linkedInBranch) {
        throw new Error(
          "Les eleves importes se modifient depuis leur branche scolaire d'origine",
        );
      }

      if (student.branchMember?.branchId !== branchId) {
        throw new Error("Etudiant introuvable dans cette branche");
      }

      const userId = student.branchMember?.member?.user?.id;

      if (!userId) {
        throw new Error("User lié introuvable");
      }

      const sexeMap: Record<string, "M" | "F"> = {
        masculin: "M",
        feminin: "F",
        M: "M",
        F: "F",
      };

      await prisma.user.update({
        where: { id: userId },
        data: {
          username: rest.username,
          email: rest.email || undefined,
          name: rest.name,
          postnom: rest.postnom,
          prenom: rest.prenom,
          dateOfBirth: rest.dateOfBirth,
          sexe: rest.sexe ? sexeMap[rest.sexe] : undefined,
          telephone: rest.telephone,
          address: rest.address,
        },
      });

      // 2. UPDATE STUDENT
      const updatedStudent = await prisma.student.update({
        where: { id: student.id },
        data: {
          category: parseCategory(category),
          placeOfBirth: placeOfBirth || null,

          // gestion propre du parent
          parent: parentId ? { connect: { id: parentId } } : undefined,
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
          parent: true,
        },
      });

      revalidateStudentPages(organizationId, branchId);
      return {
        ok: true,
        message: "Étudiant mis à jour avec succès",
        student: updatedStudent,
      };
    } catch (error: any) {
      console.error("UPDATE ERROR:", error);
      throw new Error(error.message);
    }
  });

export const updateStudentExtraInfoAction = action
  .input(
    z.object({
      studentId: z.string().min(1),
      studentExtra: studentExtraInfoSchema,
      /** Optionnel : réservé à l'inscription. En édition élève, ne pas envoyer (géré côté parent). */
      familyExtra: familyExtraInfoSchema.optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, canUpdateStudents } =
      await getCurrentBranch();
    if (!canUpdateStudents) {
      return { ok: false as const, message: "Action non autorisee" };
    }

    const student = await prisma.student.findFirst({
      where: {
        id: input.studentId,
        branchMember: { branchId, member: { organizationId } },
      },
      select: { id: true, parentId: true },
    });
    if (!student) {
      return { ok: false as const, message: "Élève introuvable." };
    }

    await prisma.student.update({
      where: { id: student.id },
      data: studentExtraToDb(input.studentExtra),
    });

    // Infos famille uniquement si fournies (ex. inscription). Sinon : fiche parent.
    if (input.familyExtra) {
      await prisma.parent.update({
        where: { id: student.parentId },
        data: familyExtraToDb(input.familyExtra),
      });
      revalidatePath(
        `/admin/organizations/${organizationId}/branches/${branchId}/parent`,
      );
    }

    revalidateStudentPages(organizationId, branchId);
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/student/${student.id}`,
    );
    return { ok: true as const, message: "Informations mises à jour." };
  });

/* ======================================================
   ARCHIVE / DÉSACTIVER DANS LA BRANCHE
====================================================== */
export const archiveStudentAction = action
  .input(deleteStudentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, canDeleteStudents } = await getCurrentBranch();
    if (!canDeleteStudents) {
      return {
        success: false,
        message: "Action non autorisee",
      };
    }

    const student = await prisma.student.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        branchMemberId: true,
        branchMember: { select: { branchId: true } },
      },
    });

    if (!student) {
      return {
        success: false,
        message: "Étudiant introuvable",
      };
    }

    const linkedInBranch = await prisma.studentBranchLink.findFirst({
      where: {
        studentId: student.id,
        targetBranchId: branchId,
        isActive: true,
      },
      select: { id: true },
    });

    if (linkedInBranch) {
      const { unlinkStudentFromBranchAction } = await import(
        "../brevets/brevet.action"
      );
      return unlinkStudentFromBranchAction(student.id);
    }

    if (student.branchMember?.branchId !== branchId) {
      return {
        success: false,
        message: "Etudiant introuvable dans cette branche",
      };
    }

    try {
      await deactivatePersonInBranch({
        branchMemberId: student.branchMemberId,
        studentId: student.id,
      });

      revalidateStudentPages(organizationId, branchId);
      return {
        ok: true,
        message:
          "Élève désactivé dans cette branche. L'historique est conservé.",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Erreur lors de la désactivation",
      };
    }
  });

const updateStudentPhotoSchema = z.object({
  studentId: z.string().min(1),
  imageUrl: z.string().min(1),
});

export const updateStudentPhotoAction = action
  .input(updateStudentPhotoSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, organizationId, canUpdateStudents } = await getCurrentBranch();
      if (!canUpdateStudents) {
        return {
          ok: false,
          message: "Action non autorisee",
        };
      }

      const { studentId, imageUrl } = input;

      const student = await prisma.student.findUnique({
        where: { id: studentId },
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

      if (!student) {
        throw new Error("Etudiant introuvable");
      }

      const linkedInBranch = await prisma.studentBranchLink.findFirst({
        where: {
          studentId: student.id,
          targetBranchId: branchId,
          isActive: true,
        },
        select: { id: true },
      });

      if (linkedInBranch) {
        throw new Error(
          "Les eleves importes se modifient depuis leur branche scolaire d'origine",
        );
      }

      if (student.branchMember?.branchId !== branchId) {
        throw new Error("Etudiant introuvable dans cette branche");
      }

      const userId = student.branchMember?.member?.user?.id;
      if (!userId) {
        throw new Error("User lie introuvable");
      }

      const hadPhoto = Boolean(student.branchMember.member.user.image?.trim());

      await prisma.user.update({
        where: { id: userId },
        data: { image: imageUrl },
      });

      revalidateStudentPages(organizationId, branchId);
      revalidatePath(
        `/admin/organizations/${organizationId}/branches/${branchId}/student/${studentId}`,
      );

      return {
        ok: true,
        message: hadPhoto
          ? "Photo mise a jour avec succes"
          : "Photo ajoutee avec succes",
      };
    } catch (error: unknown) {
      console.error("UPDATE STUDENT PHOTO ERROR:", error);
      throw new Error(errMessage(error));
    }
  });

/** Suppression définitive (propriétaire) : cascade des données liées. */
export const deleteStudentPermanentlyAction = action
  .input(deleteStudentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, canDeleteStudents, canPurgePermanently } =
      await getCurrentBranch();
    if (!canDeleteStudents) {
      return {
        ok: false as const,
        message: "Action non autorisée",
      };
    }

    try {
      if (canPurgePermanently) {
        const result = await purgeStudentPermanently({
          studentId: input.id,
          branchId,
          force: true,
        });
        if (result.ok) {
          revalidateStudentPages(organizationId, branchId);
        }
        return result;
      }

      const student = await prisma.student.findFirst({
        where: {
          id: input.id,
          branchMember: { branchId },
        },
        select: { id: true, branchMemberId: true },
      });

      if (!student) {
        return {
          ok: false as const,
          message: "Élève introuvable dans cette branche",
        };
      }

      await deactivatePersonInBranch({
        branchMemberId: student.branchMemberId,
        studentId: student.id,
      });
      revalidateStudentPages(organizationId, branchId);
      return {
        ok: true as const,
        message:
          "Élève désactivé dans cette branche. Il reste membre de l'organisation ; l'historique est conservé.",
      };
    } catch (error: unknown) {
      return {
        ok: false as const,
        message: errMessage(error) || "Erreur lors de la suppression",
      };
    }
  });

/** @deprecated Utiliser archiveStudentAction */
export const deleteStudentAction = archiveStudentAction;

const studentExamCodesSchema = z.object({
  studentId: z.string().min(1),
  schoolYearId: z.string().min(1),
  e13: z.string().trim().max(40).optional().or(z.literal("")),
  e80: z.string().trim().max(40).optional().or(z.literal("")),
});

/** Enregistre ou met à jour les codes E13 / E80 pour l'inscription de l'année. */
export const saveStudentExamCodesAction = action
  .input(studentExamCodesSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, canUpdateStudents, typebranch, educationSystem } =
      await getCurrentBranch();
    if (!canUpdateStudents) {
      throw new Error("Permission insuffisante pour modifier les codes E13/E80.");
    }

    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        studentId: input.studentId,
        schoolYearId: input.schoolYearId,
        branchId,
        statusEnrollment: true,
      },
      select: {
        id: true,
        e13: true,
        e80: true,
        classe: {
          select: {
            level: true,
            cycle: true,
            nameClasse: true,
            codeClasse: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new Error(
        "Aucune inscription active trouvée pour cet élève et cette année.",
      );
    }

    if (
      !isExamCodesClass({
        cycle: enrollment.classe?.cycle,
        typebranch,
        level: enrollment.classe?.level,
        className: enrollment.classe?.nameClasse,
        classCode: enrollment.classe?.codeClasse,
        educationSystem,
      })
    ) {
      throw new Error(
        "Les codes E13 et E80 ne sont disponibles que pour les classes terminales.",
      );
    }

    const e13 = input.e13?.trim() || null;
    const e80 = input.e80?.trim() || null;
    const alreadySet = Boolean(enrollment.e13 || enrollment.e80);

    const updated = await prisma.classEnrollment.update({
      where: { id: enrollment.id },
      data: { e13, e80 },
      select: { e13: true, e80: true },
    });

    revalidateStudentPages(organizationId, branchId);

    return {
      ok: true as const,
      updated: alreadySet,
      e13: updated.e13,
      e80: updated.e80,
      message: alreadySet
        ? "Codes E13 & E80 mis à jour"
        : "Codes E13 & E80 enregistrés",
    };
  });
