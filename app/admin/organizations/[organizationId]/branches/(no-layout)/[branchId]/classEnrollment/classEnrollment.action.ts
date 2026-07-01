"use server";

import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import {
  classEnrollmentSchema,
  IclassEnrollment,
} from "@/src/interfaces/classEnrollment";
import z from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

export const createClassEnrollmentAction = action
  .input(classEnrollmentSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { schoolYearId, classeId, studentId } = input;
    const [schoolYear, classe, student] = await Promise.all([
      prisma.schoolYear.findFirst({ where: { id: schoolYearId, branchId } }),
      prisma.classe.findFirst({ where: { id: classeId, branchId } }),
      prisma.student.findFirst({
        where: {
          id: studentId,
          branchMember: {
            branchId,
          },
        },
      }),
    ]);

    if (!schoolYear || !classe || !student) {
      throw new Error("Inscription impossible dans cette branche");
    }

    const ClassEnrollment = await prisma.classEnrollment.create({
      data: {
        schoolYearId,
        studentId,
        classeId,
        branchId,
        statusEnrollment: true,
      },
    });
    if (ClassEnrollment) {
      return {
        success: true,
        message: "Enrollment success",
      };
    }
  });

//delete ClassEnrollment
export const deleteClassEnrollAction = action
  .input(classEnrollmentSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { id } = input;
    const existing = await prisma.classEnrollment.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Inscription introuvable dans cette branche");

    const deleteClassEnroll = await prisma.classEnrollment.delete({
      where: {
        id,
      },
    });
    return deleteClassEnroll;
  });

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
    const { branchId } = await requireBranchContext();
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
  });

export const statusClassEnrollAction = action
  .input(classEnrollmentSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
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
  });
