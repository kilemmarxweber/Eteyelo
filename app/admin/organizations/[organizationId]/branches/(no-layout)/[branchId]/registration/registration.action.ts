"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/zsa";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { Prisma } from "@/prisma/generated/prisma/client";
import { findAvailableClassForLevel } from "@/lib/class-enrollment/find-available-class";
import { matchesClassForLevel } from "@/lib/class-enrollment/match-class-for-level";
import { getClassLevelsForBranch, requiresOptionForClass, allowsOptionForBranch } from "@/lib/class-structure";
import { buildClassCode, buildClassName, validateClassInput } from "@/lib/class-structure";
import { ensureUniqueIdentifier, generateSlug } from "@/lib/generated-identifiers";
import { registrationSchema } from "@/src/interfaces/registration";
import { creneauSchema } from "@/src/interfaces/creneau";
import { createOrganizationMemberAction } from "../../../../members/actions";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";

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

const STUDENT_EMAIL_DOMAIN = "klambocore.com";

const requestStudentSchema = z.object({
  name: z.string(), postnom: z.string(), prenom: z.string(), sexe: z.enum(["masculin", "feminin"]),
  dateOfBirth: z.string(), placeOfBirth: z.string(), address: z.string(), email: z.string().optional(), telephone: z.string().optional(), provenanceEcole: z.string().optional(),
});
const requestGuardianSchema = z.object({
  name: z.string(), postnom: z.string(), prenom: z.string(), relationship: z.string(), sexe: z.enum(["masculin", "feminin"]), telephone: z.string(), email: z.string().optional(), address: z.string(), isPrimary: z.boolean(),
});
type RegistrationRequestRow = {
  id: string; reference: string; status: string; studentData: Prisma.JsonValue;
  guardiansData: Prisma.JsonValue; requestedLevel: string | null; requestedOption: string | null;
  photoUrl: string | null; schoolYearId: string | null; createdAt: Date;
};

export const getPendingRegistrationRequestsAction = action.handler(async () => {
  const { branchId, organizationId } = await requireRegistrationContext();
  return prisma.$queryRaw<RegistrationRequestRow[]>(Prisma.sql`
    SELECT "id", "reference", "status"::text, "studentData", "guardiansData",
      "requestedLevel", "requestedOption", "photoUrl", "schoolYearId", "createdAt"
    FROM "RegistrationRequest"
    WHERE "branchId" = ${branchId} AND "organizationId" = ${organizationId}
      AND "status" IN ('PENDING'::"RegistrationRequestStatus", 'CONFIRMED'::"RegistrationRequestStatus")
    ORDER BY "createdAt" DESC LIMIT 50
  `);
});

export const confirmRegistrationRequestAction = action
  .input(z.object({ requestId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId } = await requireRegistrationContext();
    const updated = await prisma.$executeRaw(Prisma.sql`
      UPDATE "RegistrationRequest" SET "status" = 'CONFIRMED'::"RegistrationRequestStatus",
        "confirmedAt" = NOW(), "confirmedById" = ${userId}, "updatedAt" = NOW()
      WHERE "id" = ${input.requestId} AND "branchId" = ${branchId}
        AND "organizationId" = ${organizationId} AND "status" = 'PENDING'::"RegistrationRequestStatus"
    `);
    if (updated !== 1) {
      const existing = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "RegistrationRequest" WHERE "id" = ${input.requestId}
          AND "branchId" = ${branchId} AND "organizationId" = ${organizationId}
          AND "status" = 'CONFIRMED'::"RegistrationRequestStatus" LIMIT 1
      `);
      if (!existing[0]) throw new Error("Cette demande n'est plus disponible.");
    }
    return { requestId: input.requestId };
  });

export const getRegistrationRequestForPrefillAction = action
  .input(z.object({ requestId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireRegistrationContext();
    const [request] = await prisma.$queryRaw<RegistrationRequestRow[]>(Prisma.sql`
      SELECT "id", "reference", "status"::text, "studentData", "guardiansData",
        "requestedLevel", "requestedOption", "photoUrl", "schoolYearId", "createdAt"
      FROM "RegistrationRequest" WHERE "id" = ${input.requestId} AND "branchId" = ${branchId}
        AND "organizationId" = ${organizationId} AND "status" = 'CONFIRMED'::"RegistrationRequestStatus" LIMIT 1
    `);
    if (!request) throw new Error("Demande confirmee introuvable.");
    const student = requestStudentSchema.parse(request.studentData);
    const guardians = z.array(requestGuardianSchema).parse(request.guardiansData);
    const option = request.requestedOption
      ? await prisma.option.findFirst({
          where: { branchId, nameOption: { equals: request.requestedOption, mode: "insensitive" }, statusOption: true },
          select: { id: true },
        })
      : null;
    return {
      id: request.id,
      reference: request.reference,
      student,
      guardians,
      requestedLevel: request.requestedLevel ?? "",
      requestedOption: request.requestedOption ?? "",
      optionId: option?.id ?? "",
      photoUrl: request.photoUrl ?? "",
      schoolYearId: request.schoolYearId ?? "",
    };
  });

async function buildStudentEmail(name: string, prenom: string) {
  const localBase = generateSlug(`${prenom}.${name}`, "eleve");
  const localPart = await ensureUniqueIdentifier({
    base: localBase,
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.user.findFirst({
          where: { email: `${value}@${STUDENT_EMAIL_DOMAIN}` },
          select: { id: true },
        }),
      ),
  });
  return `${localPart}@${STUDENT_EMAIL_DOMAIN}`;
}

async function buildParentUsername(name: string, prenom: string) {
  const localBase = `parent.${generateSlug(`${prenom}.${name}`, "parent")}`;
  return ensureUniqueIdentifier({
    base: localBase,
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.user.findFirst({
          where: { username: value },
          select: { id: true },
        }),
      ),
  });
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
  const primaryStructure =
    typebranch === "PRIMAIRE"
      ? await ensurePrimaryAcademicStructure(prisma, branchId)
      : null;
  const [schoolYears, classes, options, branch, annualCounts, creneaux] = await Promise.all([
    prisma.schoolYear.findMany({
      where: { branchId, isArchived: false },
      orderBy: { startYear: "desc" },
      select: { id: true, nameYear: true, isCurrentYear: true },
    }),
    prisma.classe.findMany({
      where: {
        branchId,
        OR: [{ statusClasse: true }, { statusClasse: null }],
      },
      orderBy: [{ level: "asc" }, { parallel: "asc" }, { nameClasse: "asc" }],
      select: {
        id: true,
        nameClasse: true,
        level: true,
        parallel: true,
        optionId: true,
        capacity: true,
        option: { select: { id: true, nameOption: true } },
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
    prisma.creneau.findMany({
      where: { branchId, isArchived: false },
      orderBy: { nameCreneau: "asc" },
      select: { id: true, nameCreneau: true },
    }),
  ]);
  return {
    schoolYears,
    classes,
    options,
    creneaux,
    levels: [...getClassLevelsForBranch(typebranch)],
    typebranch,
    allowsOption: allowsOptionForBranch(typebranch),
    primaryStructure,
    branchName: branch.name,
    annualStudentCounts: Object.fromEntries(
      annualCounts.map((item) => [item.schoolYearId, item._count.studentId]),
    ),
  };
});

export const createCreneauForRegistrationAction = action
  .input(creneauSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireRegistrationContext();
    const {
      nameCreneau,
      startTime,
      endTime,
      durationCourse,
      recreationDuration,
      recreationHour,
    } = input;
    const [heuresDebut, minutesDebut] = startTime.split(":").map(Number);
    const [heuresFin, minutesFin] = endTime.split(":").map(Number);
    const [recreHeure, recreMinutes] = recreationHour.split(":").map(Number);
    const existingCreneau = await prisma.creneau.findFirst({
      where: { branchId, nameCreneau },
      select: { id: true },
    });
    if (existingCreneau) {
      throw new Error("La vacation existe déjà dans cette branche.");
    }
    const creneau = await prisma.creneau.create({
      data: {
        nameCreneau,
        startTime: new Date(Date.UTC(2000, 1, 1, heuresDebut, minutesDebut)),
        endTime: new Date(Date.UTC(2000, 1, 1, heuresFin, minutesFin)),
        durationCourse,
        recreationDuration,
        branchId,
        recreationHour: new Date(Date.UTC(2000, 1, 1, recreHeure, recreMinutes)),
      },
      select: { id: true, nameCreneau: true },
    });
    const base = `/admin/organizations/${organizationId}/branches/${branchId}`;
    revalidatePath(`${base}/registration`);
    revalidatePath(`${base}/creneau`);
    revalidatePath(`${base}/classe`);
    return creneau;
  });

export const createNextParallelForRegistrationAction = action
  .input(
    z.object({
      schoolYearId: z.string().min(1),
      level: z.string().min(1),
      optionId: z.string().optional(),
      creneauId: z.string().min(1, "La vacation est obligatoire."),
      capacity: z.number().int().positive().optional(),
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
    const option =
      typebranch === "PRIMAIRE"
        ? (await ensurePrimaryAcademicStructure(prisma, branchId)).option
        : validated.optionId
          ? await prisma.option.findFirst({
              where: { id: validated.optionId, branchId, statusOption: true },
              select: { id: true, nameOption: true },
            })
          : null;
    if (validated.optionId && !option)
      throw new Error("Option introuvable dans cette branche.");

    const creneau = await prisma.creneau.findFirst({
      where: { id: input.creneauId, branchId, isArchived: false },
      select: { id: true },
    });
    if (!creneau) throw new Error("Vacation introuvable dans cette branche.");

    const existingClasses = await prisma.classe.findMany({
      where: {
        branchId,
        OR: [{ statusClasse: true }, { statusClasse: null }],
      },
      select: {
        id: true,
        codeClasse: true,
        parallel: true,
        capacity: true,
        level: true,
        optionId: true,
        nameClasse: true,
        option: { select: { id: true, nameOption: true } },
        classEnrollment: {
          where: { statusEnrollment: true, schoolYearId: input.schoolYearId },
          select: { id: true },
        },
      },
      orderBy: { parallel: "asc" },
    });
    const existing = existingClasses.filter((classe) =>
      matchesClassForLevel(classe, {
        typebranch,
        level: validated.level!,
        optionId: option?.id ?? null,
        optionName: option?.nameOption ?? null,
      }),
    );

    let parallel: string | undefined;
    let capacity = input.capacity ?? 30;
    let simpleClassToPromote: (typeof existing)[number] | undefined;

    if (existing.length === 0) {
      parallel = undefined;
    } else if (
      existing.some(
        (classe) =>
          !classe.capacity ||
          classe.classEnrollment.length < classe.capacity,
      )
    ) {
      throw new Error(
        "Une parallèle dispose encore de places disponibles. L'affectation utilisera la première classe libre.",
      );
    } else {
      const simpleClasses = existing.filter((classe) => !classe.parallel);
      const used = new Set(
        existing.map((classe) => classe.parallel?.toUpperCase()).filter(Boolean),
      );
      if (simpleClasses.length > 1) {
        throw new Error("Plusieurs classes simples existent pour ce niveau. Corrigez leur configuration avant de continuer.");
      }
      if (simpleClasses.length === 1) {
        if (used.size > 0) {
          throw new Error("Une classe simple et des parallèles coexistent déjà pour ce niveau. Corrigez leur configuration avant de continuer.");
        }
        simpleClassToPromote = simpleClasses[0];
        used.add("A");
      }
      let index = 0;
      parallel = "A";
      while (used.has(parallel)) {
        index += 1;
        if (index >= 26)
          throw new Error("Toutes les parallèles de A à Z existent déjà.");
        parallel = String.fromCharCode(65 + index);
      }
      capacity = existing[0]?.capacity ?? capacity;
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
    const classe = await prisma.$transaction(async (tx) => {
      if (simpleClassToPromote) {
        const promotedName = buildClassName({
          typebranch,
          level: validated.level!,
          parallel: "A",
          optionName: option?.nameOption,
        });
        const promotedCodeBase = buildClassCode({
          typebranch,
          level: validated.level!,
          parallel: "A",
          optionName: option?.nameOption,
        });
        const promotedCode = await ensureUniqueIdentifier({
          base: promotedCodeBase,
          separator: "",
          exists: async (value) =>
            Boolean(
              await tx.classe.findFirst({
                where: {
                  branchId,
                  codeClasse: value,
                  id: { not: simpleClassToPromote!.id },
                },
                select: { id: true },
              }),
            ),
        });
        await tx.classe.update({
          where: { id: simpleClassToPromote.id },
          data: {
            parallel: "A",
            nameClasse: promotedName,
            codeClasse: promotedCode,
          },
        });
      }

      return tx.classe.create({
        data: {
          branchId,
          level: validated.level,
          parallel: parallel ?? null,
          optionId: option?.id ?? null,
          capacity,
          nameClasse,
          codeClasse,
          statusClasse: true,
          creneauId: input.creneauId,
        },
        select: { id: true, nameClasse: true, capacity: true, parallel: true },
      });
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
          where: { branchId, statusEnrollment: true },
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
      where: { studentId: input.studentId, branchId, statusEnrollment: true },
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
    const { branchId, organizationId, typebranch, userId } = await requireRegistrationContext();
    const request = input.requestId
      ? (await prisma.$queryRaw<Array<{ id: string; photoUrl: string | null }>>(Prisma.sql`
          SELECT "id", "photoUrl" FROM "RegistrationRequest" WHERE "id" = ${input.requestId}
            AND "branchId" = ${branchId} AND "organizationId" = ${organizationId}
            AND "status" = 'CONFIRMED'::"RegistrationRequestStatus" LIMIT 1
        `))[0] ?? null
      : null;
    if (input.requestId && !request) throw new Error("Cette demande a deja ete traitee ou n'est plus disponible.");
    if (requiresOptionForClass(typebranch, input.level) && !input.optionId)
      throw new Error("Une option est requise pour ce niveau.");

    const selectedOption =
      typebranch === "PRIMAIRE"
        ? (await ensurePrimaryAcademicStructure(prisma, branchId)).option
        : input.optionId
          ? await prisma.option.findFirst({
          where: { id: input.optionId, branchId, statusOption: true },
          select: { id: true, nameOption: true },
            })
          : null;

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
        const duplicate = await prisma.user.findFirst({
          where: {
            OR: [
              { email: input.parent.email.toLowerCase() },
              ...(input.parent.telephone
                ? [{ telephone: input.parent.telephone }]
                : []),
            ],
          },
          select: { id: true },
        });
        if (duplicate) throw new Error("Un compte parent existe déjà avec cet email ou téléphone. Recherchez-le avant de continuer.");
        const parentUsername = await buildParentUsername(input.parent.name, input.parent.prenom);
        const created = await createOrganizationMemberAction({ ...input.parent, organizationId, orgRole: "parent" });
        if (!created.ok) throw new Error(created.message);
        createdUserIds.push(created.userId);
        newParentMemberId = created.memberId;
        await prisma.user.update({ where: { id: created.userId }, data: { username: parentUsername } });
      }

      let newStudentMemberId: string | null = null;
      let newStudentUserId: string | null = null;
      let generatedStudentEmail: string | null = null;
      if (input.studentMode === "new" && input.student) {
        generatedStudentEmail = await buildStudentEmail(input.student.name, input.student.prenom);
        const duplicate = await prisma.user.findFirst({
          where: { email: generatedStudentEmail.toLowerCase() },
          select: { id: true },
        });
        if (duplicate) throw new Error("Un compte élève existe déjà avec cet email. Recherchez-le avant de continuer.");
        const created = await createOrganizationMemberAction({
          ...input.student,
          email: generatedStudentEmail,
          telephone: undefined,
          organizationId,
          orgRole: "student",
        });
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
          await tx.user.update({ where: { id: newStudentUserId }, data: { username: studentCode, image: request?.photoUrl || undefined } });
          const branchMember = await tx.branchMember.create({ data: { branchId, memberId: newStudentMemberId, role: "STUDENT" } });
          const student = await tx.student.create({
            data: {
              branchMemberId: branchMember.id,
              parentId,
              category: input.student.category,
              statusStudent: true,
              observation: input.student.observation || null,
              provenanceEcole: input.student.provenanceEcole || null,
              placeOfBirth: input.student.placeOfBirth || null,
              suppositionClasseName: input.level,
              suppositionOption: input.optionId || null,
            },
          });
          studentId = student.id;
        } else if (studentId && existingStudent?.parentId !== parentId) {
          await tx.student.update({ where: { id: studentId }, data: { parentId, statusStudent: true } });
        }
        if (!studentId) throw new Error("Élève requis pour l'inscription.");

        const duplicateEnrollment = await tx.classEnrollment.findFirst({
          where: {
            branchId,
            schoolYearId: input.schoolYearId,
            studentId,
            statusEnrollment: true,
          },
          select: { id: true },
        });
        if (duplicateEnrollment) {
          throw new Error("Cet élève est déjà inscrit pour cette année scolaire.");
        }

        const classe = await findAvailableClassForLevel(tx, {
          branchId,
          schoolYearId: input.schoolYearId,
          level: input.level,
          optionId: selectedOption?.id ?? null,
          typebranch,
          optionName: selectedOption?.nameOption ?? null,
        });
        if (!classe) throw new Error(`Aucune classe disponible pour le niveau ${input.level}. Créez la prochaine parallèle.`);
        const enrollment = await tx.classEnrollment.create({ data: { branchId, schoolYearId: input.schoolYearId, studentId, classeId: classe.id, statusEnrollment: true } });
        if (request) {
          const marked = await tx.$executeRaw(Prisma.sql`
            UPDATE "RegistrationRequest" SET "status" = 'REGISTERED'::"RegistrationRequestStatus",
              "studentId" = ${studentId}, "registeredAt" = NOW(), "registeredById" = ${userId}, "updatedAt" = NOW()
            WHERE "id" = ${request.id} AND "status" = 'CONFIRMED'::"RegistrationRequestStatus"
          `);
          if (marked !== 1) throw new Error("Cette demande vient deja d'etre inscrite.");
        }
        return { enrollmentId: enrollment.id, studentId, parentId, classeId: classe.id, classeName: classe.nameClasse, studentCode, studentEmail: generatedStudentEmail };
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
