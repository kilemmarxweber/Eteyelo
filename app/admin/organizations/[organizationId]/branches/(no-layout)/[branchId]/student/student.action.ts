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
import { auth } from "@/lib/auth";
import {
  canManageOrganization,
  getSessionRoles,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { headers } from "next/headers";
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
import { canIssueBranchDocuments } from "@/lib/branch-document-permissions";

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

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      organizationId,
    },
    select: { typebranch: true },
  });

  if (!branch) {
    throw new Error("Branche introuvable");
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
    typebranch: branch.typebranch,
    branchMemberId: branchMember?.id ?? null,
    branchMemberRole: branchMember?.role ?? null,
    roles,
    canManageStudents: canManageOrganization(session, branchMember?.role),
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
    const { branchId, organizationId, canManageStudents, typebranch } =
      await getCurrentBranch();
    if (!canManageStudents) {
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

    const parentId = input.parentId;
    const { category, orgRole, email, telephone, placeOfBirth, ...data } = input;
    if (!parentId) {
      return {
        ok: false,
        message: "Parent obligatoire pour créer un élève",
      };
    }

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
      // 2. CREATE BRANCH MEMBER
      // =========================
      const branchMember = await prisma.branchMember.create({
        data: {
          memberId: result.memberId,
          branchId,
          role: "STUDENT",
        },
      });

      // =========================
      // 3. CREATE STUDENT
      // =========================
      const student = await prisma.student.create({
        data: {
          branchMemberId: branchMember.id,
          parentId,
          category: parseCategory(category),
          placeOfBirth: placeOfBirth || null,
        },
      });

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
    createdAt: Date;
    updatedAt: Date;
    branchMember: {
      memberId: string;
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
        } | null;
      };
      branch?: { id: string; name: string } | null;
    };
    parent: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
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
        } | null };
      } | null;
    };
    classEnrollment: Array<{
      classe: { codeClasse: string; nameClasse: string } | null;
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
  const currentEnrollment = student.classEnrollment[0];

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
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    statusUser: user?.statusUser || true,
    address: user?.address || "",
    category: student.category || "NORMAL",
    placeOfBirth: student.placeOfBirth,
    classCode: currentEnrollment?.classe?.codeClasse ?? null,
    className: currentEnrollment?.classe?.nameClasse ?? null,
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
          statusUser: parentUser?.statusUser || true,
          address: parentUser?.address || "",
          students: null,
        }
      : undefined,
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
  classEnrollment: {
    where: {
      statusEnrollment: true,
      schoolYear: { isCurrentYear: true },
    },
    take: 1,
    include: { classe: true },
  },
} as const;

export const getStudentsAction = action.handler(
  async (): Promise<IStudent[]> => {
    const {
      branchId,
      organizationId,
      branchMemberId,
      canManageStudents,
      isParent,
      isStudent,
      isTeacher,
      typebranch,
    } = await getCurrentBranch();

    if (requiresStudentImport(typebranch)) {
      const links = await prisma.studentBranchLink.findMany({
        where: { targetBranchId: branchId, isActive: true },
        include: {
          sourceBranch: { select: { id: true, name: true } },
          student: {
            include: {
              ...studentListInclude,
              classEnrollment: {
                where: {
                  branchId,
                  statusEnrollment: true,
                  schoolYear: { isCurrentYear: true },
                },
                take: 1,
                include: { classe: true },
              },
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
          where: canManageStudents
            ? { branchMember: { branchId, member: { organizationId } } }
            : { id: "__no_student_access__" },
          include: {
            ...studentListInclude,
            classEnrollment: {
              where: {
                branchId,
                statusEnrollment: true,
                schoolYear: { isCurrentYear: true },
              },
              take: 1,
              include: { classe: true },
            },
          },
        }),
        prisma.studentBranchLink.findMany({
          where: { targetBranchId: branchId, isActive: true },
          include: {
            sourceBranch: { select: { id: true, name: true } },
            student: {
              include: {
                ...studentListInclude,
                classEnrollment: {
                  where: {
                    branchId,
                    statusEnrollment: true,
                    schoolYear: { isCurrentYear: true },
                  },
                  take: 1,
                  include: { classe: true },
                },
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
      where: canManageStudents
        ? baseWhere
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
                      classe: {
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
        classEnrollment: {
          where: {
            branchId,
            statusEnrollment: true,
            schoolYear: { isCurrentYear: true },
          },
          take: 1,
          include: { classe: true },
        },
      },
    });

    return students.map((student) => mapStudentRecord(student));
  },
);

function extractStudentReportLogo(image: unknown): string {
  if (!image || typeof image !== "object" || Array.isArray(image)) return "";
  const logo = (image as Record<string, unknown>).logo;
  if (typeof logo !== "string" || !logo.trim()) return "";

  return logo.startsWith("http") ||
    logo.startsWith("data:") ||
    logo.startsWith("/")
    ? logo
    : `/uploads/${logo}`;
}

export const getStudentReportContextAction = action.handler(async () => {
  const { branchId, organizationId } = await getCurrentBranch();
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: {
      name: true,
      image: true,
      organization: { select: { name: true, logo: true } },
      schoolYear: {
        where: { isCurrentYear: true, isArchived: false },
        select: { nameYear: true },
        take: 1,
      },
    },
  });

  if (!branch) throw new Error("Branche active introuvable");

  return {
    branchName: branch.name,
    organizationName: branch.organization.name,
    schoolYearName: branch.schoolYear[0]?.nameYear ?? "",
    logoUrl:
      extractStudentReportLogo(branch.image) || branch.organization.logo || "",
  };
});

/* ======================================================
   UPDATE
====================================================== */
export const updateStudentAction = action
  .input(studentSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, organizationId, canManageStudents } = await getCurrentBranch();
      if (!canManageStudents) {
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

/* ======================================================
   ARCHIVE
====================================================== */
export const archiveStudentAction = action
  .input(deleteStudentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, canManageStudents } = await getCurrentBranch();
    if (!canManageStudents) {
      return {
        success: false,
        message: "Action non autorisee",
      };
    }

    const student = await prisma.student.findUnique({
      where: { id: input.id },
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
      const userId = student.branchMember?.member?.user?.id;

      await prisma.student.update({
        where: { id: student.id },
        data: { statusStudent: false },
      });

      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { statusUser: false },
        });
      }

      revalidateStudentPages(organizationId, branchId);
      return {
        ok: true,
        message: "Étudiant archivé avec succès",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Erreur lors de l'archivage",
      };
    }
  });

/** @deprecated Utiliser archiveStudentAction */
export const deleteStudentAction = archiveStudentAction;
