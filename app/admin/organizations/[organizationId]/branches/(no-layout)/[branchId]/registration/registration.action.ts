"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/zsa";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { Prisma } from "@/prisma/generated/prisma/client";
import { findAvailableClassForLevel } from "@/lib/class-enrollment/find-available-class";
import { getClassLevelsForBranch, requiresOptionForClass } from "@/lib/class-structure";
import { buildClassCode, buildClassName, validateClassInput } from "@/lib/class-structure";
import { ensureUniqueIdentifier } from "@/lib/generated-identifiers";
import { registrationSchema } from "@/src/interfaces/registration";
import { createOrganizationMemberAction } from "../../../../members/actions";

async function requireRegistrationContext() {
  const context = await requireBranchContext();
  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId: context.branchId,
      member: { userId: context.userId, organizationId: context.organizationId },
    },
    select: { role: true },
  });
  if (!canManageOrganization(context.session, branchMember?.role)) {
    throw new Error("Vous n'avez pas la permission de gérer les inscriptions.");
  }
  return context;
}

function buildStudentCode(branchName: string, studentName: string, sequence: number) {
  const initials = branchName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
  const now = new Date();
  const dayMonth = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nameInitial = studentName.trim().charAt(0).toUpperCase() || "X";
  return `${initials}-${dayMonth}${nameInitial}${sequence}`;
}

const personSelect = {
  id: true,
  branchMember: { select: { member: { select: { user: { select: { name: true, postnom: true, prenom: true, email: true, telephone: true } } } } } },
} as const;

export const findParentForRegistrationAction = action
  .input(z.object({ query: z.string().trim().min(2) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireRegistrationContext();
    return prisma.parent.findMany({
      where: {
        branchMember: { branchId, member: { organizationId } },
        OR: [
          { branchMember: { member: { user: { name: { contains: input.query, mode: "insensitive" } } } } },
          { branchMember: { member: { user: { email: { contains: input.query, mode: "insensitive" } } } } },
          { branchMember: { member: { user: { telephone: { contains: input.query } } } } },
        ],
      },
      select: personSelect,
      take: 10,
    });
  });

export const getRegistrationOptionsAction = action.handler(async () => {
  const { branchId, typebranch } = await requireRegistrationContext();
  const [schoolYears, classes, options, branch, annualCounts] = await Promise.all([
    prisma.schoolYear.findMany({
      where: { branchId, isArchived: false },
      orderBy: { startYear: "desc" },
      select: { id: true, nameYear: true, isCurrentYear: true },
    }),
    prisma.classe.findMany({
      where: { branchId, statusClasse: { not: false }, level: { not: null } },
      orderBy: [{ level: "asc" }, { parallel: "asc" }],
      select: {
        id: true,
        nameClasse: true,
        level: true,
        parallel: true,
        optionId: true,
        capacity: true,
        classEnrollment: {
          where: { statusEnrollment: true },
          select: { schoolYearId: true },
        },
      },
    }),
    prisma.option.findMany({
      where: { branchId, statusOption: true },
      orderBy: { nameOption: "asc" },
      select: { id: true, nameOption: true },
    }),
    prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { name: true },
    }),
    prisma.classEnrollment.groupBy({
      by: ["schoolYearId"],
      where: { branchId },
      _count: { studentId: true },
    }),
  ]);
  return {
    schoolYears,
    classes,
    options,
    levels: [...getClassLevelsForBranch(typebranch)],
    typebranch,
    branchName: branch.name,
    annualStudentCounts: Object.fromEntries(
      annualCounts.map((item) => [item.schoolYearId, item._count.studentId]),
    ),
  };
});

export const createNextParallelForRegistrationAction = action
  .input(
    z.object({
      level: z.string().min(1),
      optionId: z.string().optional(),
      capacity: z.number().int().min(1).max(500),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } =
      await requireRegistrationContext();
    const validated = validateClassInput({
      typebranch,
      level: input.level,
      optionId: input.optionId || undefined,
    });
    const option = validated.optionId
      ? await prisma.option.findFirst({
          where: { id: validated.optionId, branchId, statusOption: true },
          select: { id: true, nameOption: true },
        })
      : null;
    if (validated.optionId && !option)
      throw new Error("Option introuvable dans cette branche.");

    const existing = await prisma.classe.findMany({
      where: {
        branchId,
        level: validated.level,
        optionId: option?.id ?? null,
      },
      select: { parallel: true },
    });
    const used = new Set(
      existing.map((classe) => classe.parallel?.toUpperCase()).filter(Boolean),
    );
    let index = 0;
    let parallel = "A";
    while (used.has(parallel)) {
      index += 1;
      if (index >= 26)
        throw new Error("Toutes les parallèles de A à Z existent déjà.");
      parallel = String.fromCharCode(65 + index);
    }

    const nameClasse = buildClassName({
      typebranch,
      level: validated.level!,
      parallel,
      optionName: option?.nameOption,
    });
    const codeBase = buildClassCode({
      typebranch,
      level: validated.level!,
      parallel,
      optionName: option?.nameOption,
    });
    const codeClasse = await ensureUniqueIdentifier({
      base: codeBase,
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.classe.findFirst({
            where: { branchId, codeClasse: value },
            select: { id: true },
          }),
        ),
    });
    const classe = await prisma.classe.create({
      data: {
        branchId,
        level: validated.level,
        parallel,
        optionId: option?.id ?? null,
        capacity: input.capacity,
        nameClasse,
        codeClasse,
        statusClasse: true,
      },
      select: { id: true, nameClasse: true, capacity: true, parallel: true },
    });
    const base = `/admin/organizations/${organizationId}/branches/${branchId}`;
    revalidatePath(`${base}/registration`);
    revalidatePath(`${base}/classe`);
    return classe;
  });

export const findStudentHistoryAction = action
  .input(z.object({ query: z.string().trim().min(2) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireRegistrationContext();
    return prisma.student.findMany({
      where: {
        branchMember: { branchId, member: { organizationId } },
        OR: [
          { branchMember: { member: { user: { name: { contains: input.query, mode: "insensitive" } } } } },
          { branchMember: { member: { user: { email: { contains: input.query, mode: "insensitive" } } } } },
          { branchMember: { member: { user: { telephone: { contains: input.query } } } } },
        ],
      },
      select: {
        ...personSelect,
        classEnrollment: {
          where: { branchId },
          orderBy: { schoolYear: { startYear: "desc" } },
          take: 1,
          select: { classe: { select: { level: true, nameClasse: true, optionId: true } }, schoolYear: { select: { nameYear: true } } },
        },
      },
      take: 10,
    });
  });

export const suggestNextClassAction = action
  .input(z.object({ studentId: z.string(), outcome: z.enum(["passed", "failed", "returning"]), manualLevel: z.string().optional() }))
  .handler(async ({ input }) => {
    const { branchId, typebranch } = await requireRegistrationContext();
    if (input.outcome === "returning") {
      if (!input.manualLevel) throw new Error("Choisissez manuellement le niveau de retour.");
      return { level: input.manualLevel, reason: "Niveau de retour choisi manuellement" };
    }
    const previous = await prisma.classEnrollment.findFirst({
      where: { studentId: input.studentId, branchId },
      orderBy: { schoolYear: { startYear: "desc" } },
      select: { classe: { select: { level: true, optionId: true } } },
    });
    const currentLevel = previous?.classe?.level;
    if (!currentLevel) throw new Error("Aucun historique de niveau exploitable.");
    if (input.outcome === "failed") return { level: currentLevel, optionId: previous.classe?.optionId, reason: "Même niveau après échec" };
    const levels = [...getClassLevelsForBranch(typebranch)];
    const index = levels.indexOf(currentLevel);
    if (index < 0 || index === levels.length - 1) throw new Error("Aucun niveau supérieur n'est configuré pour cette branche.");
    return { level: levels[index + 1], optionId: previous.classe?.optionId, reason: "Niveau supérieur après réussite" };
  });

export const createRegistrationFlowAction = action
  .input(registrationSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } = await requireRegistrationContext();
    if (requiresOptionForClass(typebranch, input.level) && !input.optionId)
      throw new Error("Une option est requise pour ce niveau.");

    const createdUserIds: string[] = [];
    try {
      const [schoolYear, existingStudent, existingParent] = await Promise.all([
        prisma.schoolYear.findFirst({ where: { id: input.schoolYearId, branchId, isArchived: false }, select: { id: true } }),
        input.studentMode === "existing" ? prisma.student.findFirst({ where: { id: input.studentId, branchMember: { branchId, member: { organizationId } } }, select: { id: true, parentId: true } }) : null,
        input.parentMode === "existing" ? prisma.parent.findFirst({ where: { id: input.parentId, branchMember: { branchId, member: { organizationId } } }, select: { id: true } }) : null,
      ]);
      if (!schoolYear) throw new Error("Année scolaire introuvable dans cette branche.");
      if (input.studentMode === "existing" && !existingStudent) throw new Error("Élève introuvable dans cette branche.");
      if (input.parentMode === "existing" && !existingParent) throw new Error("Parent introuvable dans cette branche.");

      let newParentMemberId: string | null = null;
      if (input.parentMode === "new" && input.parent) {
        const duplicate = await prisma.user.findFirst({ where: { OR: [{ email: input.parent.email.toLowerCase() }, { telephone: input.parent.telephone }] }, select: { id: true } });
        if (duplicate) throw new Error("Un compte parent existe déjà avec cet email ou téléphone. Recherchez-le avant de continuer.");
        const created = await createOrganizationMemberAction({ ...input.parent, organizationId, orgRole: "parent" });
        if (!created.ok) throw new Error(created.message);
        createdUserIds.push(created.userId);
        newParentMemberId = created.memberId;
        await prisma.user.update({ where: { id: created.userId }, data: { username: input.parent.username } });
      }

      let newStudentMemberId: string | null = null;
      let newStudentUserId: string | null = null;
      if (input.studentMode === "new" && input.student) {
        const duplicate = await prisma.user.findFirst({ where: { OR: [{ email: input.student.email.toLowerCase() }, { telephone: input.student.telephone }] }, select: { id: true } });
        if (duplicate) throw new Error("Un compte élève existe déjà avec cet email ou téléphone. Recherchez-le avant de continuer.");
        const created = await createOrganizationMemberAction({ ...input.student, organizationId, orgRole: "student" });
        if (!created.ok) throw new Error(created.message);
        createdUserIds.push(created.userId);
        newStudentMemberId = created.memberId;
        newStudentUserId = created.userId;
      }

      const result = await prisma.$transaction(async (tx) => {
        let parentId = existingParent?.id ?? existingStudent?.parentId;
        if (newParentMemberId) {
          const branchMember = await tx.branchMember.create({ data: { branchId, memberId: newParentMemberId, role: "PARENT" } });
          const parent = await tx.parent.create({ data: { branchMemberId: branchMember.id } });
          if (input.parent && input.parent.discountPercentage > 0) {
            await tx.discountRule.create({
              data: { parentId: parent.id, branchId, scope: "PARENT", percentage: input.parent.discountPercentage },
            });
          }
          parentId = parent.id;
        }
        if (!parentId) throw new Error("Parent requis pour l'inscription.");

        let studentId = existingStudent?.id;
        let studentCode: string | null = null;
        if (newStudentMemberId && newStudentUserId && input.student) {
          const [branch, annualEnrollmentCount] = await Promise.all([
            tx.branch.findUniqueOrThrow({ where: { id: branchId }, select: { name: true } }),
            tx.classEnrollment.count({ where: { branchId, schoolYearId: input.schoolYearId } }),
          ]);
          studentCode = buildStudentCode(branch.name, input.student.name, annualEnrollmentCount + 1);
          await tx.user.update({ where: { id: newStudentUserId }, data: { username: studentCode } });
          const branchMember = await tx.branchMember.create({ data: { branchId, memberId: newStudentMemberId, role: "STUDENT" } });
          const student = await tx.student.create({
            data: {
              branchMemberId: branchMember.id,
              parentId,
              category: input.student.category,
              statusStudent: true,
              observation: input.student.observation || null,
              provenanceEcole: input.student.provenanceEcole || null,
              suppositionClasseName: input.level,
              suppositionOption: input.optionId || null,
            },
          });
          studentId = student.id;
        } else if (studentId && existingStudent?.parentId !== parentId) {
          await tx.student.update({ where: { id: studentId }, data: { parentId, statusStudent: true } });
        }
        if (!studentId) throw new Error("Élève requis pour l'inscription.");

        const classe = await findAvailableClassForLevel(tx, { branchId, schoolYearId: input.schoolYearId, level: input.level, optionId: input.optionId || null });
        if (!classe) throw new Error(`Aucune classe disponible pour le niveau ${input.level}. Créez la prochaine parallèle.`);
        const enrollment = await tx.classEnrollment.create({ data: { branchId, schoolYearId: input.schoolYearId, studentId, classeId: classe.id, statusEnrollment: true } });
        return { enrollmentId: enrollment.id, studentId, parentId, classeId: classe.id, classeName: classe.nameClasse, studentCode };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      const base = `/admin/organizations/${organizationId}/branches/${branchId}`;
      revalidatePath(`${base}/registration`);
      revalidatePath(`${base}/student`);
      revalidatePath(`${base}/parent`);
      revalidatePath(`${base}/classEnrollment`);
      return result;
    } catch (error) {
      await Promise.all(createdUserIds.map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)));
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new Error("Cet élève est déjà inscrit pour cette année scolaire.");
      throw error;
    }
  });
