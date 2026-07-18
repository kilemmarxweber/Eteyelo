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
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";

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
    branchMemberId: branchMember?.id ?? null,
    roles,
    canManageStudents: canManageOrganization(session, branchMember?.role),
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
    const { branchId, organizationId, canManageStudents } =
      await getCurrentBranch();
    if (!canManageStudents) {
      return {
        ok: false,
        message: "Action non autorisee",
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
    } = await getCurrentBranch();

    const baseWhere = {
      branchMember: {
        branchId,
        member: {
          organizationId,
        },
      },
    };

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
        branchMember: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
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
            branchId,
            statusEnrollment: true,
            schoolYear: { isCurrentYear: true },
          },
          take: 1,
          include: { classe: true },
        },
      },
    });

    const transformedStudents: IStudent[] = students.map((student) => {
      const user = student.branchMember?.member?.user;

      const parentUser = student.parent.branchMember?.member.user;
      const currentEnrollment = student.classEnrollment[0];

      return {
        id: student.id,
        studentId: student.id || "",
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
              category: student.category || "NORMAL",
              student: null,
            }
          : undefined,
      };
    });

    return transformedStudents;
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
