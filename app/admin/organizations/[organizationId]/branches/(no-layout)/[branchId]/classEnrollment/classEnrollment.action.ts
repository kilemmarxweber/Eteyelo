"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import {
  classEnrollmentSchema,
  IclassEnrollment,
} from "@/src/interfaces/classEnrollment";
import z from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { findAvailableClassForLevel } from "@/lib/class-enrollment/find-available-class";
import { Prisma } from "@/prisma/generated/prisma/client";

function revalidateClassEnrollmentPages(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/classEnrollment`,
  );
}

export const createClassEnrollmentAction = action
  .input(classEnrollmentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { schoolYearId, classeId, studentId } = input;
    const [schoolYear, requestedClass, student] = await Promise.all([
      prisma.schoolYear.findFirst({ where: { id: schoolYearId, branchId } }),
      prisma.classe.findFirst({
        where: { id: classeId, branchId },
        select: { id: true, level: true, optionId: true },
      }),
      prisma.student.findFirst({
        where: {
          id: studentId,
          branchMember: {
            branchId,
          },
        },
      }),
    ]);

    if (!schoolYear || !requestedClass || !student) {
      throw new Error("Inscription impossible dans cette branche");
    }

    if (!requestedClass.level) {
      throw new Error(
        "Le niveau de la classe doit être renseigné avant l'affectation automatique.",
      );
    }

    let classEnrollment;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        classEnrollment = await prisma.$transaction(
          async (tx) => {
            const availableClass = await findAvailableClassForLevel(tx, {
              branchId,
              schoolYearId,
              level: requestedClass.level!,
              optionId: requestedClass.optionId,
            });

            if (!availableClass) {
              throw new Error(
                `Aucune classe disponible pour le niveau ${requestedClass.level}. Créez la prochaine parallèle ou augmentez une capacité.`,
              );
            }

            return tx.classEnrollment.create({
              data: {
                schoolYearId,
                studentId,
                classeId: availableClass.id,
                branchId,
                statusEnrollment: true,
              },
              include: { classe: true },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        ) {
          continue;
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new Error("Cet élève est déjà inscrit pour cette année scolaire.");
        }
        throw error;
      }
    }

    if (!classEnrollment) {
      throw new Error("L'inscription n'a pas pu être finalisée. Réessayez.");
    }
    revalidateClassEnrollmentPages(organizationId, branchId);
    return classEnrollment;
  });

//archive ClassEnrollment
export const archiveClassEnrollAction = action
  .input(classEnrollmentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { id } = input;
    const existing = await prisma.classEnrollment.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Inscription introuvable dans cette branche");

    const archivedEnrollment = await prisma.classEnrollment.update({
      where: { id },
      data: { statusEnrollment: false },
    });
    revalidateClassEnrollmentPages(organizationId, branchId);
    return archivedEnrollment;
  });

/** @deprecated Utiliser archiveClassEnrollAction */
export const deleteClassEnrollAction = archiveClassEnrollAction;

export const getClassEnrollmentByClassAction = action
  .input(
    z.object({
      classeId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<IclassEnrollment[]> => {
    try {
      const { branchId } = await requireBranchContext();
      const { classeId } = input;
      const classEnrollments = await prisma.classEnrollment.findMany({
        include: {
          student: {
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
          classe: {
            include: {
              option: true,
            },
          },
          schoolYear: true,
        },
        where: {
          classeId,
          branchId,
        },
      });
      const transformedClassEnrollments: IclassEnrollment[] =
        classEnrollments.map((classEnrollment: any) => ({
          ...classEnrollment,
          //Student
          userId:
            classEnrollment.student?.branchMember?.member?.user?.id || "",
          parentId: classEnrollment.student?.parentId || "",
          nom: classEnrollment.student?.branchMember?.member?.user?.name || "",
          postnom:
            classEnrollment.student?.branchMember?.member?.user?.postnom || "",
          prenom:
            classEnrollment.student?.branchMember?.member?.user?.prenom || "",
          dateOfBirth:
            classEnrollment.student?.branchMember?.member?.user?.dateOfBirth ||
            new Date(),
          sexe: classEnrollment.student?.branchMember?.member?.user?.sexe || "",
          email:
            classEnrollment.student?.branchMember?.member?.user?.email || "",
          username:
            classEnrollment.student?.branchMember?.member?.user?.username || "",
          statusUser:
            classEnrollment.student?.branchMember?.member?.user?.statusUser ||
            true,

          //SchoolYear
          schoolYearId: classEnrollment.schoolYearId || "",
          nameYear: classEnrollment.schoolYear?.nameYear || "",
          startYear: classEnrollment.schoolYear?.startYear || new Date(),
          endYear: classEnrollment.schoolYear?.endYear || new Date(),
          //Classe
          classeId: classEnrollment.classeId || "",
          studentId: classEnrollment.studentId || "",
          codeClasse: classEnrollment.classe?.codeClasse || "",
          nameClasse: classEnrollment.classe?.nameClasse || "",
          optionId: classEnrollment.classe?.optionId || "",
          nameOption: classEnrollment.classe?.option?.nameOption || "",
          codeOption: classEnrollment.classe?.option?.codeOption || "",
          statusClasse: classEnrollment.classe?.statusClasse || true,
          statusEnrollment: classEnrollment.statusEnrollment || true,
        }));
      return transformedClassEnrollments;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

export const getClassEnrolements = action.handler(
  async (): Promise<IclassEnrollment[]> => {
    try {
      const { branchId } = await requireBranchContext();
      const classEnrollments = await prisma.classEnrollment.findMany({
        include: {
          student: {
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
          classe: {
            include: {
              option: true,
            },
          },
          schoolYear: true,
        },
        where: {
          branchId,
        },
      });
      const transformedClassEnrollments: IclassEnrollment[] =
        classEnrollments.map((classEnrollment: any) => ({
          ...classEnrollment,
          //Student
          userId:
            classEnrollment.student?.branchMember?.member?.user?.id || "",
          parentId: classEnrollment.student?.parentId || "",
          nom: classEnrollment.student?.branchMember?.member?.user?.name || "",
          postnom:
            classEnrollment.student?.branchMember?.member?.user?.postnom || "",
          prenom:
            classEnrollment.student?.branchMember?.member?.user?.prenom || "",
          dateOfBirth:
            classEnrollment.student?.branchMember?.member?.user?.dateOfBirth ||
            new Date(),
          sexe: classEnrollment.student?.branchMember?.member?.user?.sexe || "",
          email:
            classEnrollment.student?.branchMember?.member?.user?.email || "",
          username:
            classEnrollment.student?.branchMember?.member?.user?.username || "",
          statusUser:
            classEnrollment.student?.branchMember?.member?.user?.statusUser ||
            true,

          //SchoolYear
          schoolYearId: classEnrollment.schoolYearId || "",
          nameYear: classEnrollment.schoolYear?.nameYear || "",
          startYear: classEnrollment.schoolYear?.startYear || new Date(),
          endYear: classEnrollment.schoolYear?.endYear || new Date(),
          //Classe
          classeId: classEnrollment.classeId || "",
          studentId: classEnrollment.studentId || "",
          codeClasse: classEnrollment.classe?.codeClasse || "",
          nameClasse: classEnrollment.classe?.nameClasse || "",
          optionId: classEnrollment.classe?.optionId || "",
          nameOption: classEnrollment.classe?.option?.nameOption || "",
          codeOption: classEnrollment.classe?.option?.codeOption || "",
          statusClasse: classEnrollment.classe?.statusClasse || true,
          statusEnrollment: classEnrollment.statusEnrollment || true,
        }));
      return transformedClassEnrollments;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },
);

export const updateClassEnrollmentAction = action
  .input(classEnrollmentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { statusEnrollment, id } = input;
    const existing = await prisma.classEnrollment.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Inscription introuvable dans cette branche");

    const updateClassEnrollment = await prisma.classEnrollment.update({
      where: {
        id,
      },
      data: {
        statusEnrollment,
      },
    });
    revalidateClassEnrollmentPages(organizationId, branchId);
    return updateClassEnrollment;
  });

export const statusClassEnrollAction = action
  .input(classEnrollmentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { statusEnrollment, id } = input;
    const existing = await prisma.classEnrollment.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Inscription introuvable dans cette branche");

    const updateStatusClassEnroll = await prisma.classEnrollment.update({
      where: {
        id,
      },
      data: {
        statusEnrollment,
      },
    });
    revalidateClassEnrollmentPages(organizationId, branchId);
    return updateStatusClassEnroll;
  });
