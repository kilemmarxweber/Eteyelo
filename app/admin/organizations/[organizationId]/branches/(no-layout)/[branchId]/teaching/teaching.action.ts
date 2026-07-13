"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { action } from "@/lib/zsa";
import { Prisma } from "@/prisma/generated/prisma/client";
import { ITeaching, teachingSchema } from "@/src/interfaces/Teaching";
import { z } from "zod";
import { canManageOrganization } from "@/lib/auth/session-roles";

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

function requireManageTeaching(session: unknown) {
  if (!canManageOrganization(session as Parameters<typeof canManageOrganization>[0])) {
    throw new Error("Action non autorisée");
  }
}

export const getTeachingWorkspaceAction = action.handler(async () => {
  const { branchId, organizationId } = await requireBranchContext();
  const [classes, courses, teachers, schoolYear, teachings] = await Promise.all([
    prisma.classe.findMany({
      where: {
        branchId,
        branch: { organizationId },
        OR: [{ statusClasse: true }, { statusClasse: null }],
      },
      orderBy: { nameClasse: "asc" },
      select: { id: true, nameClasse: true, codeClasse: true, option: { select: { nameOption: true, section: { select: { nameSection: true } } } } },
    }),
    prisma.cours.findMany({
      where: {
        branchId,
        branch: { organizationId },
        OR: [{ statusCours: true }, { statusCours: null }],
      },
      orderBy: { nameCours: "asc" },
      select: { id: true, nameCours: true, codeCours: true },
    }),
    prisma.teacher.findMany({
      where: {
        branchMember: {
          branchId,
          branch: { organizationId },
        },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, branchMember: { select: { member: { select: { user: { select: { name: true, postnom: true, prenom: true, username: true } } } } } } },
    }),
    prisma.schoolYear.findFirst({
      where: {
        branchId,
        branch: { organizationId },
        isCurrentYear: true,
        isArchived: false,
      },
      select: { id: true, nameYear: true },
    }),
    prisma.teaching.findMany({
      where: {
        branchId,
        branch: { organizationId },
        classe: { branchId, branch: { organizationId } },
        cours: { branchId, branch: { organizationId } },
      },
      select: { id: true, classeId: true, coursId: true, teacherId: true, schoolYearId: true, statusTeaching: true, titulaire: true, updatedAt: true },
    }),
  ]);
  return {
    classes,
    courses,
    teachers: teachers.map(teacher => ({ id: teacher.id, name: [teacher.branchMember?.member.user.name, teacher.branchMember?.member.user.postnom, teacher.branchMember?.member.user.prenom].filter(Boolean).join(" ") || teacher.branchMember?.member.user.username || "Enseignant" })),
    schoolYear,
    teachings,
  };
});

const quickAssignmentSchema = z.object({
  classeId: z.string().min(1),
  coursIds: z.array(z.string().min(1)).min(1).max(50),
  teacherId: z.string().min(1),
});

export const saveQuickAssignmentsAction = action.input(quickAssignmentSchema).handler(async ({ input }) => {
  const { branchId, organizationId, session } = await requireBranchContext();
  requireManageTeaching(session);
  const [classe, teacher, courses, schoolYear] = await Promise.all([
    prisma.classe.findFirst({ where: { id: input.classeId, branchId, branch: { organizationId }, OR: [{ statusClasse: true }, { statusClasse: null }] }, select: { id: true } }),
    prisma.teacher.findFirst({ where: { id: input.teacherId, branchMember: { branchId, branch: { organizationId } } }, select: { id: true } }),
    prisma.cours.findMany({ where: { id: { in: input.coursIds }, branchId, branch: { organizationId }, OR: [{ statusCours: true }, { statusCours: null }] }, select: { id: true } }),
    prisma.schoolYear.findFirst({ where: { branchId, branch: { organizationId }, isCurrentYear: true, isArchived: false }, select: { id: true } }),
  ]);
  if (!classe || !teacher || !schoolYear || courses.length !== new Set(input.coursIds).size) throw new Error("Contexte d'affectation invalide ou incomplet");

  const existing = await prisma.teaching.findMany({
    where: { classeId: input.classeId, schoolYearId: schoolYear.id, coursId: { in: input.coursIds } },
    select: { id: true, coursId: true, teacherId: true, Schedule: { where: { isArchived: false }, select: { day: true, hour: true } } },
  });
  const targetSchedules = await prisma.schedule.findMany({
    where: { isArchived: false, teaching: { teacherId: input.teacherId, schoolYearId: schoolYear.id } },
    select: { day: true, hour: true, teaching: { select: { classe: { select: { nameClasse: true } }, cours: { select: { nameCours: true } } } } },
  });
  for (const item of existing) {
    if (item.teacherId === input.teacherId) continue;
    const conflict = item.Schedule.find(slot => targetSchedules.some(target => target.day === slot.day && target.hour.getTime() === slot.hour.getTime()));
    if (conflict) throw new Error(`Conflit d'horaire détecté le ${conflict.day}. L'enseignant est déjà occupé à cette heure.`);
  }

  const existingMap = new Map(existing.map(item => [item.coursId, item]));
  const saved = await prisma.$transaction(input.coursIds.map(coursId => {
    const current = existingMap.get(coursId);
    return current
      ? prisma.teaching.update({ where: { id: current.id }, data: { teacherId: input.teacherId, statusTeaching: true, branchId }, select: { id: true, classeId: true, coursId: true, teacherId: true, schoolYearId: true, statusTeaching: true, titulaire: true, updatedAt: true } })
      : prisma.teaching.create({ data: { branchId, classeId: input.classeId, coursId, teacherId: input.teacherId, schoolYearId: schoolYear.id, statusTeaching: true }, select: { id: true, classeId: true, coursId: true, teacherId: true, schoolYearId: true, statusTeaching: true, titulaire: true, updatedAt: true } });
  }));
  revalidateTeachingPages(organizationId, branchId);
  return saved;
});

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
  .input(z.object({ id: z.string() }))
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
      const { branchId } = await requireBranchContext();
      const { classeId } = input;

      await requireClasseInBranch(classeId, branchId);

      const teachings = await prisma.teaching.findMany({
        include: teachingInclude,
        where: {
          classeId,
          classe: { branchId },
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
      const { branchId } = await requireBranchContext();
      const { coursId } = input;

      const teachings = await prisma.teaching.findMany({
        include: teachingInclude,
        where: {
          coursId,
          cours: { branchId },
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
    const { branchId } = await requireBranchContext();

    const teachings = await prisma.teaching.findMany({
      include: teachingInclude,
      where: {
        OR: [{ branchId }, { classe: { branchId } }],
      },
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
      const { branchId } = await requireBranchContext();
      const { teacherId } = input;

      const teachings = await prisma.teaching.findMany({
        include: teachingInclude,
        where: {
          teacherId,
          teacher: { branchMember: { branchId } },
        },
      });
      const transformedTeachings: ITeaching[] = teachings.map(mapTeaching);
      return transformedTeachings;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });
