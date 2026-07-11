"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { action } from "@/lib/zsa";
import { Prisma } from "@/prisma/generated/prisma/client";
import { ITeaching, teachingSchema } from "@/src/interfaces/Teaching";
import { z } from "zod";

const teachingInclude = {
  teacher: {
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
  classe: true,
  cours: true,
  schoolYear: true,
} satisfies Prisma.TeachingInclude;

type TeachingWithRelations = Prisma.TeachingGetPayload<{
  include: typeof teachingInclude;
}>;

function revalidateTeachingPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/teaching`);
}

async function requireClasseInBranch(classeId: string, branchId: string) {
  const classe = await prisma.classe.findFirst({
    where: { id: classeId, branchId },
    select: { id: true },
  });

  if (!classe) {
    throw new Error("Classe introuvable dans cette branche");
  }

  return classe;
}

async function requireTeachingInBranch(id: string, branchId: string) {
  const teaching = await prisma.teaching.findFirst({
    where: {
      id,
      classe: { branchId },
    },
    select: { id: true },
  });

  if (!teaching) {
    throw new Error("Enseignement introuvable dans cette branche");
  }

  return teaching;
}

function mapTeaching(teaching: TeachingWithRelations): ITeaching {
  const branchMember = teaching.teacher?.branchMember;
  const user = branchMember?.member?.user;

  return {
    ...teaching,
    titulaire: teaching.titulaire || false,
    statusTeaching: teaching.statusTeaching || true,
    //Teacher
    userId: user?.id || "",
    memberId: branchMember?.memberId || "",
    nom: user?.name || "",
    postnom: user?.postnom || "",
    prenom: user?.prenom || "",
    dateOfBirth: user?.dateOfBirth || new Date(),
    sexe: user?.sexe || "",
    email: user?.email || "",
    username: user?.username || "",
    telephone: user?.telephone || "",
    address: user?.address || "",
    statusUser: user?.statusUser || true,

    //SchoolYear
    schoolYearId: teaching.schoolYearId || "",
    isCurrentYear: teaching.schoolYear?.isCurrentYear || false,
    nameYear: teaching.schoolYear?.nameYear || "",
    startYear: teaching.schoolYear?.startYear || new Date(),
    endYear: teaching.schoolYear?.endYear || new Date(),

    //Classe
    branchId: teaching.branchId || "",
    classeId: teaching.classeId || "",
    teacherId: teaching.teacherId || "",
    codeClasse: teaching.classe?.codeClasse || "",
    nameClasse: teaching.classe?.nameClasse || "",
    optionId: teaching.classe?.optionId || "",
    statusClasse: teaching.classe?.statusClasse || true,

    //Cours
    coursId: teaching.coursId || "",
    codeCours: teaching.cours?.codeCours || "",
    nameCours: teaching.cours?.nameCours || "",
    description: teaching.cours?.description || "",
  };
}

export const createTeachingAction = action
  .input(teachingSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { teacherId, classeId, coursId, schoolYearId, titulaire } = input;

    await requireClasseInBranch(classeId, branchId);

    try {
      const teaching = await prisma.teaching.create({
        data: {
          teacherId,
          classeId,
          coursId,
          schoolYearId,
          titulaire,
          branchId,
        },
      });

      revalidateTeachingPages(organizationId, branchId);
      return teaching;
    } catch (error: any) {
      if (error.code === "P2002") {
        throw new Error(
          "Cet enseignant est déjà assigné à ce cours dans cette classe pour cette année.",
        );
      }

      throw new Error(error.message);
    }
  });

//delete Teaching -> archive
export const archiveTeachingAction = action
  .input(teachingSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { id } = input;

    if (!id) throw new Error("ID requis");

    await requireTeachingInBranch(id, branchId);

    const archivedTeaching = await prisma.teaching.update({
      where: { id },
      data: { statusTeaching: false },
    });
    revalidateTeachingPages(organizationId, branchId);
    return archivedTeaching;
  });

/** @deprecated Utiliser archiveTeachingAction */
export const deleteTeachingAction = archiveTeachingAction;

export const updateTeachingAction = action
  .input(teachingSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { id, teacherId, classeId, coursId, schoolYearId, titulaire } = input;

    if (!id) throw new Error("ID requis");

    await requireTeachingInBranch(id, branchId);
    await requireClasseInBranch(classeId, branchId);

    const teaching = await prisma.teaching.update({
      data: {
        teacherId,
        classeId,
        coursId,
        schoolYearId,
        titulaire,
        branchId,
      },
      where: {
        id,
      },
    });

    revalidateTeachingPages(organizationId, branchId);
    return teaching;
  });

export const getTeachingByClassAction = action
  .input(
    z.object({
      classeId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ITeaching[]> => {
    try {
      const { classeId } = input;

      const teachings = await prisma.teaching.findMany({
        include: teachingInclude,
        where: {
          classeId,
        },
      });
      const transformedTeachings: ITeaching[] = teachings.map(mapTeaching);
      return transformedTeachings;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });
export const getTeachingByCoursAction = action
  .input(
    z.object({
      coursId: z.string().optional(),
    }),
  )
  .handler(async ({ input }): Promise<ITeaching[]> => {
    try {
      const { coursId } = input;

      const teachings = await prisma.teaching.findMany({
        include: teachingInclude,
        where: {
          coursId,
        },
      });
      const transformedTeachings: ITeaching[] = teachings.map(mapTeaching);
      return transformedTeachings;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

export const getTeachings = action.handler(async (): Promise<ITeaching[]> => {
  try {
    const teachings = await prisma.teaching.findMany({
      include: teachingInclude,
    });
    const transformedTeachings: ITeaching[] = teachings.map(mapTeaching);
    return transformedTeachings;
  } catch (error: any) {
    throw new Error(error.message);
  }
});

export const getTeachingByTeacherAction = action
  .input(
    z.object({
      teacherId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ITeaching[]> => {
    try {
      const { teacherId } = input;

      const teachings = await prisma.teaching.findMany({
        include: teachingInclude,
        where: {
          teacherId,
        },
      });
      const transformedTeachings: ITeaching[] = teachings.map(mapTeaching);
      return transformedTeachings;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });
