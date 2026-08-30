"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/zsa";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessRegistrationArea } from "@/lib/auth/session-roles";
import { Prisma } from "@/prisma/generated/prisma/client";
import { findAvailableClassForLevel } from "@/lib/class-enrollment/find-available-class";
import { appendStudentToOpenClassFiches } from "@/lib/sync-fiche-students";
import { matchesClassForLevel } from "@/lib/class-enrollment/match-class-for-level";
import { getClassLevelsForBranch, requiresOptionForClass, allowsOptionForBranch, isCtebLevel } from "@/lib/class-structure";
import { ensureSecondaryCtebStructure } from "@/lib/secondary-cteb-structure";
import { ensureAngolaSecondaryStructure } from "@/lib/angola-secondary-bootstrap";
import {
  isAngolaFirstCycleLevel,
  isAngolaSecondarySystem,
} from "@/lib/angola-secondary-structure";
import { buildClassCode, buildClassName, validateClassInput } from "@/lib/class-structure";
import { ensureUniqueIdentifier, generateSlug } from "@/lib/generated-identifiers";
import { registrationSchema } from "@/src/interfaces/registration";
import { creneauSchema } from "@/src/interfaces/creneau";
import { normalizeCreneauWorkingDays } from "@/lib/creneau-working-days";
import { createOrganizationMemberAction } from "../../../../members/actions";
import {
  ensurePrimaryAcademicStructure,
  getPrimaryOptionForLevel,
} from "@/lib/primary-academic-structure";
import {
  ensureMaternelleAcademicStructure,
  getMaternelleOptionForLevel,
} from "@/lib/maternelle-academic-structure";
import { getPeopleLabels } from "@/lib/people-labels";
import { isCentreFormationBranch } from "@/lib/branch-capabilities";
import { ensureCentreDefaultParent } from "@/lib/centre-default-parent";
import { validateRegistrationParentInput } from "@/src/interfaces/registration";
import { resolveCycle, resolveRequestedCycle } from "@/lib/cycle";
import {
  familyExtraToDb,
  pickFamilyExtraFromUnknown,
  pickStudentExtraFromUnknown,
  studentExtraToDb,
  type FamilyExtraInfo,
} from "@/lib/registration-extra-info";
import {
  computeScopedDiscountAmount,
  EMPTY_DISCOUNT,
  getBestDiscountInfo,
} from "@/lib/payment-discount";

function formatFeeAmount(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

type EnrollmentFeeSource = {
  id: string;
  classeId: string;
  schoolYearId: string;
  schoolYear: { nameYear: string };
  classe: { nameClasse: string } | null;
  student: { parentId: string | null } | null;
};

/**
 * Solde des frais d'une inscription (année de référence).
 * Inclut la remise familiale comme pour le tableau de bord caissier.
 */
async function getEnrollmentFeeBalance(
  branchId: string,
  enrollment: EnrollmentFeeSource,
) {
  const fraisList = await prisma.frais.findMany({
    where: {
      branchId,
      statusFrais: true,
      classeId: enrollment.classeId,
      OR: [
        { schoolYearId: enrollment.schoolYearId },
        { schoolYearId: null },
      ],
    },
    select: {
      id: true,
      nameFrais: true,
      montantFrais: true,
      typeFraisId: true,
    },
  });

  if (fraisList.length === 0) {
    return {
      schoolYearName: enrollment.schoolYear.nameYear,
      classeName: enrollment.classe?.nameClasse ?? "",
      totalDue: 0,
      totalPaid: 0,
      remaining: 0,
    };
  }

  const paidAgg = await prisma.familyPayment.groupBy({
    by: ["fraisId"],
    where: {
      branchId,
      classEnrollmentId: enrollment.id,
      fraisId: { in: fraisList.map((f) => f.id) },
      status: "VALIDE",
    },
    _sum: { amount: true },
  });
  const paidByFrais = new Map(
    paidAgg.map((row) => [row.fraisId, Number(row._sum.amount ?? 0)]),
  );

  const parentId = enrollment.student?.parentId ?? null;
  const discount = parentId
    ? await getBestDiscountInfo(prisma, parentId, branchId)
    : EMPTY_DISCOUNT;

  const totalBrut = fraisList.reduce(
    (sum, f) => sum + Number(f.montantFrais),
    0,
  );
  const remise = computeScopedDiscountAmount(
    fraisList.map((f) => ({
      base: Number(f.montantFrais),
      typeFraisId: f.typeFraisId,
    })),
    discount,
  );
  const totalDue = Math.max(0, totalBrut - remise);
  const totalPaid = fraisList.reduce(
    (sum, f) => sum + (paidByFrais.get(f.id) ?? 0),
    0,
  );
  const remaining = Math.max(0, totalDue - totalPaid);

  return {
    schoolYearName: enrollment.schoolYear.nameYear,
    classeName: enrollment.classe?.nameClasse ?? "",
    totalDue,
    totalPaid,
    remaining,
  };
}

async function findLatestStudentEnrollment(
  branchId: string,
  studentId: string,
  excludeSchoolYearId?: string,
) {
  return prisma.classEnrollment.findFirst({
    where: {
      studentId,
      branchId,
      OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
      ...(excludeSchoolYearId
        ? { schoolYearId: { not: excludeSchoolYearId } }
        : {}),
    },
    orderBy: { schoolYear: { startYear: "desc" } },
    select: {
      id: true,
      classeId: true,
      schoolYearId: true,
      schoolYear: { select: { nameYear: true } },
      classe: {
        select: {
          nameClasse: true,
          level: true,
          optionId: true,
          cycle: true,
          option: { select: { sectionId: true } },
        },
      },
      student: { select: { parentId: true } },
    },
  });
}

async function assertEnrollmentFeesSettledForPromotion(
  branchId: string,
  enrollment: EnrollmentFeeSource,
) {
  const balance = await getEnrollmentFeeBalance(branchId, enrollment);
  if (balance.remaining <= 0.009) return;

  const context =
    balance.classeName && balance.schoolYearName
      ? `${balance.classeName} (${balance.schoolYearName})`
      : balance.schoolYearName || "l'année passée";

  throw new Error(
    `Impossible de monter en classe supérieure : les frais de ${context} ne sont pas soldés. Reste à payer : ${formatFeeAmount(balance.remaining)} (payé ${formatFeeAmount(balance.totalPaid)} / dû ${formatFeeAmount(balance.totalDue)}).`,
  );
}

async function requireRegistrationContext() {
  const context = await requireBranchContext();
  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId: context.branchId,
      member: { userId: context.userId, organizationId: context.organizationId },
    },
    select: { role: true },
  });
  if (!canAccessRegistrationArea(context.session, branchMember?.role)) {
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

const requestStudentSchema = z
  .object({
    name: z.string(),
    postnom: z.string().optional().or(z.literal("")),
    prenom: z.string().optional().or(z.literal("")),
    sexe: z.enum(["masculin", "feminin"]),
    dateOfBirth: z.string(),
    placeOfBirth: z.string(),
    address: z.string(),
    email: z.string().optional(),
    telephone: z.string().optional(),
    provenanceEcole: z.string().optional(),
  })
  .passthrough();
const requestGuardianSchema = z.object({
  name: z.string(),
  postnom: z.string().optional().or(z.literal("")),
  prenom: z.string().optional().or(z.literal("")),
  relationship: z.string(),
  sexe: z.enum(["masculin", "feminin"]),
  telephone: z.string(),
  email: z.string().optional(),
  address: z.string(),
  isPrimary: z.boolean(),
});
type RegistrationRequestRow = {
  id: string;
  reference: string;
  status: string;
  studentData: Prisma.JsonValue;
  guardiansData: Prisma.JsonValue;
  requestedLevel: string | null;
  requestedOption: string | null;
  photoUrl: string | null;
  schoolYearId: string | null;
  siblingGroupId: string | null;
  createdAt: Date;
};

export const getPendingRegistrationRequestsAction = action.handler(async () => {
  const { branchId, organizationId } = await requireRegistrationContext();
  return prisma.$queryRaw<RegistrationRequestRow[]>(Prisma.sql`
    SELECT "id", "reference", "status"::text, "studentData", "guardiansData",
      "requestedLevel", "requestedOption", "photoUrl", "schoolYearId",
      "siblingGroupId", "createdAt"
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

export const rejectRegistrationRequestAction = action
  .input(
    z.object({
      requestId: z.string().min(1),
      reason: z.string().trim().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireRegistrationContext();
    const reason = input.reason?.trim() || null;
    const updated = await prisma.$executeRaw(Prisma.sql`
      UPDATE "RegistrationRequest"
      SET "status" = 'REJECTED'::"RegistrationRequestStatus",
          "rejectedReason" = ${reason},
          "updatedAt" = NOW()
      WHERE "id" = ${input.requestId} AND "branchId" = ${branchId}
        AND "organizationId" = ${organizationId}
        AND "status" IN (
          'PENDING'::"RegistrationRequestStatus",
          'CONFIRMED'::"RegistrationRequestStatus"
        )
    `);
    if (updated !== 1) {
      throw new Error("Cette demande n'est plus disponible.");
    }
    return { requestId: input.requestId };
  });

export const getRegistrationRequestForPrefillAction = action
  .input(z.object({ requestId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireRegistrationContext();
    const [request] = await prisma.$queryRaw<
      Array<
        RegistrationRequestRow & {
          siblingGroupId: string | null;
        }
      >
    >(Prisma.sql`
      SELECT "id", "reference", "status"::text, "studentData", "guardiansData",
        "requestedLevel", "requestedOption", "photoUrl", "schoolYearId",
        "siblingGroupId", "createdAt"
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

    const studentExtra = pickStudentExtraFromUnknown(request.studentData);
    const familyExtra = pickFamilyExtraFromUnknown(
      (request.studentData as Record<string, unknown>)?.familyExtra ??
        request.studentData,
    );

    const primaryGuardian =
      guardians.find((item) => item.isPrimary) ?? guardians[0] ?? null;

    type MatchedParent = {
      parentId: string;
      parentLabel: string;
      profession: string | null;
      name: string;
      postnom: string;
      prenom: string;
      email: string;
      telephone: string;
      address: string;
      matchReason: "sibling" | "email" | "telephone";
      familyExtra: FamilyExtraInfo;
    };

    let matchedExistingParent: MatchedParent | null = null;

    const parentSelect = {
      id: true,
      profession: true,
      nomMere: true,
      professionMere: true,
      tuteurNom: true,
      adresseTuteur: true,
      provinceOrigine: true,
      territoireOrigine: true,
      secteurOrigine: true,
      villageOrigine: true,
      branchMember: {
        select: {
          member: {
            select: {
              user: {
                select: {
                  name: true,
                  postnom: true,
                  prenom: true,
                  email: true,
                  telephone: true,
                  address: true,
                },
              },
            },
          },
        },
      },
    } as const;

    function toMatchedParent(
      parent: {
        id: string;
        profession: string | null;
        nomMere: string | null;
        professionMere: string | null;
        tuteurNom: string | null;
        adresseTuteur: string | null;
        provinceOrigine: string | null;
        territoireOrigine: string | null;
        secteurOrigine: string | null;
        villageOrigine: string | null;
        branchMember: {
          member: {
            user: {
              name: string | null;
              postnom: string | null;
              prenom: string | null;
              email: string | null;
              telephone: string | null;
              address: string | null;
            } | null;
          } | null;
        } | null;
      },
      matchReason: MatchedParent["matchReason"],
    ): MatchedParent {
      const u = parent.branchMember?.member?.user;
      return {
        parentId: parent.id,
        parentLabel: [u?.name, u?.postnom, u?.prenom].filter(Boolean).join(" "),
        profession: parent.profession,
        name: u?.name ?? "",
        postnom: u?.postnom ?? "",
        prenom: u?.prenom ?? "",
        email: u?.email ?? "",
        telephone: u?.telephone ?? "",
        address: u?.address ?? "",
        matchReason,
        familyExtra: {
          nomMere: parent.nomMere ?? "",
          professionMere: parent.professionMere ?? "",
          tuteurNom: parent.tuteurNom ?? "",
          adresseTuteur: parent.adresseTuteur ?? "",
          provinceOrigine: parent.provinceOrigine ?? "",
          territoireOrigine: parent.territoireOrigine ?? "",
          secteurOrigine: parent.secteurOrigine ?? "",
          villageOrigine: parent.villageOrigine ?? "",
        },
      };
    }

    if (request.siblingGroupId) {
      const siblings = await prisma.$queryRaw<
        Array<{ studentId: string | null; status: string }>
      >(Prisma.sql`
        SELECT "studentId", "status"::text
        FROM "RegistrationRequest"
        WHERE "siblingGroupId" = ${request.siblingGroupId}
          AND "branchId" = ${branchId}
          AND "organizationId" = ${organizationId}
          AND "id" <> ${request.id}
          AND "status" = 'REGISTERED'::"RegistrationRequestStatus"
          AND "studentId" IS NOT NULL
        ORDER BY "registeredAt" ASC NULLS LAST
        LIMIT 1
      `);
      const siblingStudentId = siblings[0]?.studentId;
      if (siblingStudentId) {
        const siblingStudent = await prisma.student.findFirst({
          where: {
            id: siblingStudentId,
            branchMember: { branchId, member: { organizationId } },
          },
          select: {
            parent: { select: parentSelect },
          },
        });
        if (siblingStudent?.parent) {
          matchedExistingParent = toMatchedParent(
            siblingStudent.parent,
            "sibling",
          );
        }
      }
    }

    if (!matchedExistingParent && primaryGuardian) {
      const guardianEmail = primaryGuardian.email?.trim().toLowerCase() || "";
      const guardianPhone = primaryGuardian.telephone?.trim() || "";
      const phoneUsable =
        guardianPhone &&
        guardianPhone !== "+" &&
        guardianPhone !== "+243"
          ? guardianPhone
          : "";

      if (guardianEmail) {
        const byEmail = await prisma.parent.findFirst({
          where: {
            branchMember: {
              branchId,
              member: {
                organizationId,
                user: { email: { equals: guardianEmail, mode: "insensitive" } },
              },
            },
          },
          select: parentSelect,
        });
        if (byEmail) {
          matchedExistingParent = toMatchedParent(byEmail, "email");
        }
      }

      if (!matchedExistingParent && phoneUsable) {
        const byPhone = await prisma.parent.findFirst({
          where: {
            branchMember: {
              branchId,
              member: {
                organizationId,
                user: { telephone: phoneUsable },
              },
            },
          },
          select: parentSelect,
        });
        if (byPhone) {
          matchedExistingParent = toMatchedParent(byPhone, "telephone");
        }
      }
    }

    return {
      id: request.id,
      reference: request.reference,
      siblingGroupId: request.siblingGroupId,
      student,
      guardians,
      studentExtra,
      familyExtra: matchedExistingParent?.familyExtra ?? familyExtra,
      matchedExistingParent,
      /** @deprecated alias — prefer matchedExistingParent */
      existingSiblingParent: matchedExistingParent,
      requestedLevel: request.requestedLevel ?? "",
      requestedOption: request.requestedOption ?? "",
      optionId: option?.id ?? "",
      photoUrl: request.photoUrl ?? "",
      schoolYearId: request.schoolYearId ?? "",
    };
  });

async function buildStudentEmail(name: string, prenom?: string | null) {
  const localBase = generateSlug(
    [prenom?.trim(), name.trim()].filter(Boolean).join(".") || name.trim() || "eleve",
    "eleve",
  );
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

/** Email parent généré (même logique que l'élève) si aucun email saisi. */
async function buildParentEmail(name: string, prenom?: string | null) {
  const localBase = generateSlug(
    [prenom?.trim(), name.trim()].filter(Boolean).join(".") || name.trim() || "parent",
    "parent",
  );
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

async function buildParentUsername(name: string, prenom?: string | null) {
  const localBase = `parent.${generateSlug(
    [prenom?.trim(), name.trim()].filter(Boolean).join(".") || name.trim() || "parent",
    "parent",
  )}`;
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

function optionalTrimmed(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalPhone(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "+" || trimmed === "+243") return undefined;
  return trimmed;
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
      select: { ...personSelect, profession: true },
      take: 10,
    });
  });

export const getRegistrationOptionsAction = action.handler(async () => {
  const { branchId, typebranch, educationSystem, cycles } =
    await requireRegistrationContext();
  const hasSecondaire =
    cycles.includes("SECONDAIRE") || typebranch === "SECONDAIRE";
  if (
    hasSecondaire &&
    !isAngolaSecondarySystem("SECONDAIRE", educationSystem)
  ) {
    await ensureSecondaryCtebStructure(prisma, branchId);
  }
  const primaryStructure = cycles.includes("PRIMAIRE")
    ? await ensurePrimaryAcademicStructure(prisma, branchId)
    : null;
  const maternelleStructure = cycles.includes("MATERNELLE")
    ? await ensureMaternelleAcademicStructure(prisma, branchId)
    : null;
  const [schoolYears, classes, options, sections, branch, annualCounts, creneaux, typeFrais] = await Promise.all([
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
        cycle: true,
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
      select: {
        id: true,
        nameOption: true,
        codeOption: true,
        sectionId: true,
        cycle: true,
        section: {
          select: { id: true, nameSection: true, codeSection: true },
        },
      },
    }),
    prisma.section.findMany({
      where: { branchId, statusSection: true },
      orderBy: { nameSection: "asc" },
      select: { id: true, nameSection: true, codeSection: true, cycle: true },
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
    prisma.typeFrais.findMany({
      where: { branchId, statusType: true },
      orderBy: { nameType: "asc" },
      select: { id: true, nameType: true, codeType: true },
    }),
  ]);
  return {
    schoolYears,
    classes,
    options,
    sections,
    creneaux,
    typeFrais,
    levels: [...getClassLevelsForBranch(typebranch, educationSystem)],
    cycles,
    typebranch,
    educationSystem,
    allowsOption: allowsOptionForBranch(typebranch),
    primaryStructure,
    maternelleStructure,
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
      workingDays,
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
        workingDays: normalizeCreneauWorkingDays(workingDays),
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
      cycle: z
        .enum([
          "MATERNELLE",
          "PRIMAIRE",
          "SECONDAIRE",
          "ATELIER",
          "CENTRE_FORMATION",
          "UNIVERSITE",
        ])
        .optional(),
      optionId: z.string().optional(),
      creneauId: z.string().min(1, "La vacation est obligatoire."),
      capacity: z.number().int().positive().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch, educationSystem, cycles } =
      await requireRegistrationContext();
    const academicCycle = resolveRequestedCycle({
      cycle: input.cycle,
      branchCycles: cycles,
      typebranch,
    });
    let optionId = input.optionId;
    if (
      isAngolaSecondarySystem(academicCycle, educationSystem) &&
      isAngolaFirstCycleLevel(input.level)
    ) {
      optionId = (await ensureAngolaSecondaryStructure(prisma, branchId)).option
        .id;
    } else if (academicCycle === "SECONDAIRE" && isCtebLevel(input.level)) {
      optionId = (await ensureSecondaryCtebStructure(prisma, branchId)).option.id;
    }
    const isPrimaire = academicCycle === "PRIMAIRE";
    const isMaternelle = academicCycle === "MATERNELLE";
    const validated = validateClassInput({
      typebranch: academicCycle,
      educationSystem,
      level: input.level,
      optionId: isPrimaire || isMaternelle ? undefined : optionId || undefined,
    });
    const option = isPrimaire
      ? getPrimaryOptionForLevel(
          await ensurePrimaryAcademicStructure(prisma, branchId),
          validated.level ?? input.level,
        )
      : isMaternelle
        ? getMaternelleOptionForLevel(
            await ensureMaternelleAcademicStructure(prisma, branchId),
            validated.level ?? input.level,
          )
        : validated.optionId
          ? await prisma.option.findFirst({
              where: { id: validated.optionId, branchId, statusOption: true },
              select: { id: true, nameOption: true },
            })
          : null;
    if (!option) {
      throw new Error(
        isPrimaire
          ? "Niveau primaire invalide pour la pondération."
          : isMaternelle
            ? "Niveau maternelle invalide pour la pondération."
            : "Option introuvable dans cette branche.",
      );
    }

    const creneau = await prisma.creneau.findFirst({
      where: { id: input.creneauId, branchId, isArchived: false },
      select: { id: true },
    });
    if (!creneau) throw new Error("Vacation introuvable dans cette branche.");

    const existingClasses = await prisma.classe.findMany({
      where: {
        branchId,
      },
      select: {
        id: true,
        codeClasse: true,
        parallel: true,
        capacity: true,
        level: true,
        optionId: true,
        cycle: true,
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
        typebranch: academicCycle,
        educationSystem,
        level: validated.level!,
        optionId: option?.id ?? null,
        optionName: option?.nameOption ?? null,
        cycle: academicCycle,
      }),
    );

    const capacity = input.capacity ?? 30;
    const hasFreeSeats = (classe: (typeof existing)[number]) =>
      classe.capacity != null &&
      classe.capacity > 0 &&
      classe.classEnrollment.length < classe.capacity;
    const needsCapacity = (classe: (typeof existing)[number]) =>
      classe.capacity == null || classe.capacity <= 0;

    // Classes catalogue sans capacité : définir la capacité avant d'ouvrir une parallèle.
    if (existing.length > 0 && existing.some(needsCapacity)) {
      if (existing.some(hasFreeSeats)) {
        const free = existing.find(hasFreeSeats)!;
        return {
          id: free.id,
          nameClasse: free.nameClasse,
          capacity: free.capacity,
          parallel: free.parallel,
        };
      }
      const target = existing.find(needsCapacity)!;
      const updated = await prisma.classe.update({
        where: { id: target.id },
        data: { capacity, creneauId: input.creneauId },
        select: { id: true, nameClasse: true, capacity: true, parallel: true },
      });
      const base = `/admin/organizations/${organizationId}/branches/${branchId}`;
      revalidatePath(`${base}/registration`);
      revalidatePath(`${base}/classe`);
      return updated;
    }

    let parallel: string | undefined;
    let simpleClassToPromote: (typeof existing)[number] | undefined;
    let nextCapacity = capacity;

    if (existing.length === 0) {
      parallel = undefined;
    } else if (existing.some(hasFreeSeats)) {
      const free = existing.find(hasFreeSeats)!;
      return {
        id: free.id,
        nameClasse: free.nameClasse,
        capacity: free.capacity,
        parallel: free.parallel,
      };
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
      nextCapacity = existing.find((c) => c.capacity && c.capacity > 0)?.capacity ?? capacity;
    }

    const nameClasse = buildClassName({
      typebranch: academicCycle,
      level: validated.level!,
      parallel,
      optionName: option?.nameOption,
    });
    const nameTaken = await prisma.classe.findFirst({
      where: { branchId, nameClasse },
      select: { id: true, cycle: true },
    });
    if (nameTaken && !simpleClassToPromote) {
      throw new Error(
        nameTaken.cycle && nameTaken.cycle !== academicCycle
          ? `Le nom « ${nameClasse} » est déjà utilisé par une classe ${nameTaken.cycle.toLowerCase()}.`
          : "La classe existe déjà dans cette branche.",
      );
    }
    const codeBase = buildClassCode({
      typebranch: academicCycle,
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
          typebranch: academicCycle,
          level: validated.level!,
          parallel: "A",
          optionName: option?.nameOption,
        });
        const promotedCodeBase = buildClassCode({
          typebranch: academicCycle,
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

    const already = await tx.classe.findFirst({
      where: { branchId, nameClasse },
      select: {
        id: true,
        nameClasse: true,
        capacity: true,
        parallel: true,
      },
    });
    if (already) {
      return tx.classe.update({
        where: { id: already.id },
        data: {
          statusClasse: true,
          cycle: academicCycle,
          level: validated.level,
          parallel: parallel ?? already.parallel,
          ...(option?.id ? { optionId: option.id } : {}),
          capacity:
            already.capacity && already.capacity > 0
              ? already.capacity
              : nextCapacity,
          creneauId: input.creneauId,
        },
        select: { id: true, nameClasse: true, capacity: true, parallel: true },
      });
    }

    try {
      return await tx.classe.create({
        data: {
          branchId,
          level: validated.level,
          parallel: parallel ?? null,
          optionId: option?.id ?? null,
          cycle: academicCycle,
          capacity: nextCapacity,
          nameClasse,
          codeClasse,
          statusClasse: true,
          creneauId: input.creneauId,
        },
        select: { id: true, nameClasse: true, capacity: true, parallel: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const fallback = await tx.classe.findFirst({
          where: {
            branchId,
            OR: [{ nameClasse }, { codeClasse }],
          },
          select: {
            id: true,
            nameClasse: true,
            capacity: true,
            parallel: true,
          },
        });
        if (fallback) return fallback;
        throw new Error(
          "Cette classe existe déjà dans l'établissement. Actualisez la page.",
        );
      }
      throw error;
    }
    });
    const base = `/admin/organizations/${organizationId}/branches/${branchId}`;
    revalidatePath(`${base}/registration`);
    revalidatePath(`${base}/classe`);
    return classe;
  });

export const updateRegistrationClassCapacityAction = action
  .input(
    z.object({
      classeId: z.string().min(1),
      capacity: z.number().int().positive(),
      schoolYearId: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireRegistrationContext();
    const existing = await prisma.classe.findFirst({
      where: {
        id: input.classeId,
        branchId,
        OR: [{ statusClasse: true }, { statusClasse: null }],
      },
      select: {
        id: true,
        nameClasse: true,
        capacity: true,
        classEnrollment: {
          where: input.schoolYearId
            ? { schoolYearId: input.schoolYearId }
            : undefined,
          select: { id: true },
        },
      },
    });
    if (!existing) {
      throw new Error("Classe introuvable dans cette branche.");
    }
    const occupied = existing.classEnrollment.length;
    if (input.capacity < occupied) {
      throw new Error(
        `Capacité trop basse : ${occupied} inscription(s) déjà présentes.`,
      );
    }
    const updated = await prisma.classe.update({
      where: { id: existing.id },
      data: { capacity: input.capacity },
      select: {
        id: true,
        nameClasse: true,
        capacity: true,
        parallel: true,
      },
    });
    const base = `/admin/organizations/${organizationId}/branches/${branchId}`;
    revalidatePath(`${base}/registration`);
    revalidatePath(`${base}/classe`);
    return updated;
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
        parentId: true,
        parent: {
          select: {
            id: true,
            profession: true,
            branchMember: {
              select: {
                member: {
                  select: {
                    user: {
                      select: {
                        name: true,
                        postnom: true,
                        prenom: true,
                        email: true,
                        telephone: true,
                        address: true,
                        sexe: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        classEnrollment: {
          where: { branchId, statusEnrollment: true },
          orderBy: { schoolYear: { startYear: "desc" } },
          take: 1,
          select: {
            classe: {
              select: {
                level: true,
                nameClasse: true,
                optionId: true,
                option: { select: { id: true, sectionId: true } },
              },
            },
            schoolYear: { select: { nameYear: true } },
          },
        },
      },
      take: 10,
    });
  });

export const suggestNextClassAction = action
  .input(z.object({ studentId: z.string(), outcome: z.enum(["passed", "failed", "returning"]), manualLevel: z.string().optional() }))
  .handler(async ({ input }) => {
    const { branchId, typebranch, educationSystem } = await requireRegistrationContext();
    if (input.outcome === "returning") {
      if (!input.manualLevel) throw new Error("Choisissez manuellement le niveau de retour.");
      return {
        level: input.manualLevel,
        optionId: null as string | null,
        sectionId: null as string | null,
        cycle: null as string | null,
        reason: "Niveau de retour choisi manuellement",
      };
    }
    const previous = await findLatestStudentEnrollment(
      branchId,
      input.studentId,
    );
    const currentLevel = previous?.classe?.level;
    if (!previous || !currentLevel) {
      throw new Error("Aucun historique de niveau exploitable.");
    }
    const classCycle = resolveCycle(previous.classe, { typebranch });

    if (input.outcome === "failed") {
      return {
        level: currentLevel,
        optionId: previous.classe?.optionId ?? null,
        sectionId: previous.classe?.option?.sectionId ?? null,
        cycle: classCycle,
        reason: "Même niveau après échec — année actuelle",
      };
    }

    await assertEnrollmentFeesSettledForPromotion(branchId, previous);

    const levels = [...getClassLevelsForBranch(classCycle, educationSystem)];
    const index = levels.indexOf(currentLevel);
    if (index < 0 || index === levels.length - 1) {
      throw new Error("Aucun niveau supérieur n'est configuré pour ce cycle.");
    }
    const nextLevel = levels[index + 1];

    if (classCycle === "PRIMAIRE") {
      const structure = await ensurePrimaryAcademicStructure(prisma, branchId);
      const primaryOption = getPrimaryOptionForLevel(structure, nextLevel);
      return {
        level: nextLevel,
        optionId: primaryOption?.id ?? null,
        sectionId: structure.section.id,
        cycle: classCycle,
        reason: "Niveau supérieur après réussite — année actuelle",
      };
    }

    if (classCycle === "MATERNELLE") {
      const structure = await ensureMaternelleAcademicStructure(prisma, branchId);
      const maternelleOption = getMaternelleOptionForLevel(structure, nextLevel);
      return {
        level: nextLevel,
        optionId: maternelleOption?.id ?? null,
        sectionId: structure.section.id,
        cycle: classCycle,
        reason: "Niveau supérieur après réussite — année actuelle",
      };
    }

    return {
      level: nextLevel,
      optionId: previous.classe?.optionId ?? null,
      sectionId: previous.classe?.option?.sectionId ?? null,
      cycle: classCycle,
      reason: "Niveau supérieur après réussite — année actuelle",
    };
  });

export const createRegistrationFlowAction = action
  .input(registrationSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch, educationSystem, userId, cycles } = await requireRegistrationContext();
    const peopleLabels = getPeopleLabels(typebranch);
    const parentValidationError = validateRegistrationParentInput(typebranch, input);
    if (parentValidationError) {
      throw new Error(parentValidationError);
    }
    const usesDefaultParent = isCentreFormationBranch(typebranch);
    let centreDefaultParentId: string | null = null;
    if (usesDefaultParent) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { name: true },
      });
      centreDefaultParentId = await ensureCentreDefaultParent({
        branchId,
        organizationId,
        branchName: branch?.name,
      });
    }
    const request = input.requestId
      ? (await prisma.$queryRaw<Array<{ id: string; photoUrl: string | null }>>(Prisma.sql`
          SELECT "id", "photoUrl" FROM "RegistrationRequest" WHERE "id" = ${input.requestId}
            AND "branchId" = ${branchId} AND "organizationId" = ${organizationId}
            AND "status" = 'CONFIRMED'::"RegistrationRequestStatus" LIMIT 1
        `))[0] ?? null
      : null;
    if (input.requestId && !request) throw new Error("Cette demande a deja ete traitee ou n'est plus disponible.");
    const academicCycle = resolveRequestedCycle({
      cycle: input.cycle,
      branchCycles: cycles,
      typebranch,
    });
    let enrollmentOptionId = input.optionId;
    if (
      isAngolaSecondarySystem(academicCycle, educationSystem) &&
      isAngolaFirstCycleLevel(input.level)
    ) {
      enrollmentOptionId = (
        await ensureAngolaSecondaryStructure(prisma, branchId)
      ).option.id;
    } else if (academicCycle === "SECONDAIRE" && isCtebLevel(input.level)) {
      enrollmentOptionId = (
        await ensureSecondaryCtebStructure(prisma, branchId)
      ).option.id;
    }
    if (
      requiresOptionForClass(academicCycle, input.level, educationSystem) &&
      !enrollmentOptionId
    ) {
      throw new Error("Une option est requise pour ce niveau.");
    }

    const selectedOption =
      academicCycle === "PRIMAIRE"
        ? getPrimaryOptionForLevel(
            await ensurePrimaryAcademicStructure(prisma, branchId),
            input.level,
          )
        : academicCycle === "MATERNELLE"
          ? getMaternelleOptionForLevel(
              await ensureMaternelleAcademicStructure(prisma, branchId),
              input.level,
            )
          : enrollmentOptionId
            ? await prisma.option.findFirst({
                where: { id: enrollmentOptionId, branchId, statusOption: true },
                select: { id: true, nameOption: true },
              })
            : null;
    if (academicCycle === "PRIMAIRE" && !selectedOption) {
      throw new Error("Niveau primaire invalide pour la pondération.");
    }
    if (academicCycle === "MATERNELLE" && !selectedOption) {
      throw new Error("Niveau maternelle invalide pour la pondération.");
    }

    const createdUserIds: string[] = [];
    try {
      const [schoolYear, existingStudent, existingParent] = await Promise.all([
        prisma.schoolYear.findFirst({ where: { id: input.schoolYearId, branchId, isArchived: false }, select: { id: true } }),
        input.studentMode === "existing" ? prisma.student.findFirst({ where: { id: input.studentId, branchMember: { branchId, member: { organizationId } } }, select: { id: true, parentId: true } }) : null,
        input.parentMode === "existing" ? prisma.parent.findFirst({ where: { id: input.parentId, branchMember: { branchId, member: { organizationId } } }, select: { id: true } }) : null,
      ]);
      if (!schoolYear) throw new Error("Année scolaire introuvable dans cette branche.");
      if (input.studentMode === "existing" && !existingStudent) throw new Error(`${peopleLabels.student} introuvable dans cette branche.`);
      if (input.parentMode === "existing" && !existingParent && !usesDefaultParent) throw new Error("Parent introuvable dans cette branche.");

      if (
        input.studentMode === "existing" &&
        input.historyOutcome === "passed" &&
        input.studentId
      ) {
        const previousEnrollment = await findLatestStudentEnrollment(
          branchId,
          input.studentId,
          input.schoolYearId,
        );
        if (previousEnrollment) {
          await assertEnrollmentFeesSettledForPromotion(
            branchId,
            previousEnrollment,
          );
        }
      }

      let newParentMemberId: string | null = null;
      let generatedParentEmail: string | null = null;
      if (!usesDefaultParent && input.parentMode === "new" && input.parent) {
        const parentPhone = optionalPhone(input.parent.telephone);
        generatedParentEmail =
          optionalTrimmed(input.parent.email) ??
          (await buildParentEmail(input.parent.name, input.parent.prenom));

        const duplicate = await prisma.user.findFirst({
          where: {
            OR: [
              { email: generatedParentEmail.toLowerCase() },
              ...(parentPhone ? [{ telephone: parentPhone }] : []),
            ],
          },
          select: { id: true },
        });
        if (duplicate) throw new Error("Un compte parent existe déjà avec cet email ou téléphone. Recherchez-le avant de continuer.");
        const parentUsername = await buildParentUsername(input.parent.name, input.parent.prenom);
        const created = await createOrganizationMemberAction({
          name: input.parent.name,
          postnom: optionalTrimmed(input.parent.postnom) ?? undefined,
          prenom: optionalTrimmed(input.parent.prenom) ?? undefined,
          sexe: input.parent.sexe,
          dateOfBirth: input.parent.dateOfBirth,
          email: generatedParentEmail,
          telephone: parentPhone,
          address: optionalTrimmed(input.parent.address),
          organizationId,
          branchId,
          orgRole: "parent",
        });
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
        if (duplicate) throw new Error(`Un compte ${peopleLabels.studentLower} existe déjà avec cet email. Recherchez-le avant de continuer.`);
        const created = await createOrganizationMemberAction({
          name: input.student.name,
          postnom: optionalTrimmed(input.student.postnom) ?? undefined,
          prenom: optionalTrimmed(input.student.prenom) ?? undefined,
          sexe: input.student.sexe,
          dateOfBirth: input.student.dateOfBirth,
          email: generatedStudentEmail,
          telephone: undefined,
          address: optionalTrimmed(input.student.address),
          organizationId,
          branchId,
          orgRole: "student",
        });
        if (!created.ok) throw new Error(created.message);
        createdUserIds.push(created.userId);
        newStudentMemberId = created.memberId;
        newStudentUserId = created.userId;
      }

      const result = await prisma.$transaction(async (tx) => {
        let parentId =
          centreDefaultParentId ?? existingParent?.id ?? existingStudent?.parentId;
        if (newParentMemberId) {
          const branchMember = await tx.branchMember.create({ data: { branchId, memberId: newParentMemberId, role: "PARENT" } });
          const profession = input.parent?.profession?.trim() || null;
          const parent = await tx.parent.create({
            data: {
              branchMemberId: branchMember.id,
              profession,
              ...familyExtraToDb({
                nomMere:
                  input.familyExtra?.nomMere || input.parent?.nomMere || "",
                professionMere:
                  input.familyExtra?.professionMere ||
                  input.parent?.professionMere ||
                  "",
                tuteurNom:
                  input.familyExtra?.tuteurNom || input.parent?.tuteurNom || "",
                adresseTuteur:
                  input.familyExtra?.adresseTuteur ||
                  input.parent?.adresseTuteur ||
                  "",
                provinceOrigine:
                  input.familyExtra?.provinceOrigine ||
                  input.parent?.provinceOrigine ||
                  "",
                territoireOrigine:
                  input.familyExtra?.territoireOrigine ||
                  input.parent?.territoireOrigine ||
                  "",
                secteurOrigine:
                  input.familyExtra?.secteurOrigine ||
                  input.parent?.secteurOrigine ||
                  "",
                villageOrigine:
                  input.familyExtra?.villageOrigine ||
                  input.parent?.villageOrigine ||
                  "",
              }),
            },
          });
          if (input.parent && input.parent.discountPercentage > 0) {
            const typeFraisId = input.parent.discountTypeFraisId?.trim() || null;
            if (!typeFraisId) {
              throw new Error("Type de frais requis pour la remise.");
            }
            const typeFrais = await tx.typeFrais.findFirst({
              where: { id: typeFraisId, branchId, statusType: true },
              select: { id: true },
            });
            if (!typeFrais) {
              throw new Error("Type de frais de remise introuvable dans cette branche.");
            }
            await tx.discountRule.create({
              data: {
                parentId: parent.id,
                branchId,
                scope: "PARENT",
                percentage: input.parent.discountPercentage,
                typeFraisId: typeFrais.id,
              },
            });
          }
          parentId = parent.id;
        }
        if (!parentId) throw new Error("Parent requis pour l'inscription.");

        const familyPatch = familyExtraToDb({
          nomMere: input.familyExtra?.nomMere || input.parent?.nomMere || "",
          professionMere:
            input.familyExtra?.professionMere ||
            input.parent?.professionMere ||
            "",
          tuteurNom: input.familyExtra?.tuteurNom || input.parent?.tuteurNom || "",
          adresseTuteur:
            input.familyExtra?.adresseTuteur ||
            input.parent?.adresseTuteur ||
            "",
          provinceOrigine:
            input.familyExtra?.provinceOrigine ||
            input.parent?.provinceOrigine ||
            "",
          territoireOrigine:
            input.familyExtra?.territoireOrigine ||
            input.parent?.territoireOrigine ||
            "",
          secteurOrigine:
            input.familyExtra?.secteurOrigine ||
            input.parent?.secteurOrigine ||
            "",
          villageOrigine:
            input.familyExtra?.villageOrigine ||
            input.parent?.villageOrigine ||
            "",
        });
        const hasFamilyPatch = Object.values(familyPatch).some(Boolean);
        if (hasFamilyPatch && parentId && !newParentMemberId) {
          await tx.parent.update({
            where: { id: parentId },
            data: familyPatch,
          });
        }

        let studentId = existingStudent?.id;
        let studentCode: string | null = null;
        if (newStudentMemberId && newStudentUserId && input.student) {
          const [branch, annualEnrollmentCount] = await Promise.all([
            tx.branch.findUniqueOrThrow({ where: { id: branchId }, select: { name: true } }),
            tx.classEnrollment.count({ where: { branchId, schoolYearId: input.schoolYearId } }),
          ]);
          studentCode = buildStudentCode(branch.name, input.student.name, annualEnrollmentCount + 1);
          const photoUrl = input.photoUrl || request?.photoUrl || undefined;
          await tx.user.update({
            where: { id: newStudentUserId },
            data: { username: studentCode, image: photoUrl },
          });
          const branchMember = await tx.branchMember.create({ data: { branchId, memberId: newStudentMemberId, role: "STUDENT" } });
          const student = await tx.student.create({
            data: {
              branchMemberId: branchMember.id,
              parentId,
              category: input.student.category,
              statusStudent: true,
              observation: input.student.observation || null,
              provenanceEcole: isCentreFormationBranch(typebranch)
                ? null
                : input.student.provenanceEcole || null,
              placeOfBirth: input.student.placeOfBirth || null,
              ...studentExtraToDb({
                nationalite:
                  input.studentExtra?.nationalite ||
                  input.student.nationalite ||
                  "",
                autreNationalite:
                  input.studentExtra?.autreNationalite ||
                  input.student.autreNationalite ||
                  "",
                territoireAutreNationalite:
                  input.studentExtra?.territoireAutreNationalite ||
                  input.student.territoireAutreNationalite ||
                  "",
                langue: input.studentExtra?.langue || input.student.langue || "",
              }),
              suppositionClasseName: input.level,
              suppositionOption: input.optionId || null,
            },
          });
          studentId = student.id;
        } else if (studentId && existingStudent?.parentId !== parentId) {
          await tx.student.update({ where: { id: studentId }, data: { parentId, statusStudent: true } });
        }
        if (!studentId) throw new Error(`${peopleLabels.student} requis pour l'inscription.`);

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
          throw new Error(`Cet ${peopleLabels.studentLower} est déjà inscrit pour cette année scolaire.`);
        }

        const classe = await findAvailableClassForLevel(tx, {
          branchId,
          schoolYearId: input.schoolYearId,
          level: input.level,
          optionId: selectedOption?.id ?? null,
          typebranch: academicCycle,
          optionName: selectedOption?.nameOption ?? null,
          cycle: academicCycle,
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

        let studentSearchName = "";
        if (input.student?.name || input.student?.prenom) {
          studentSearchName = [input.student.name, input.student.prenom]
            .map((part) => (typeof part === "string" ? part.trim() : ""))
            .filter(Boolean)
            .join(" ");
        } else {
          const linked = await tx.student.findFirst({
            where: { id: studentId },
            select: {
              branchMember: {
                select: {
                  member: {
                    select: {
                      user: { select: { name: true, prenom: true } },
                    },
                  },
                },
              },
            },
          });
          const user = linked?.branchMember?.member?.user;
          studentSearchName = [user?.name, user?.prenom]
            .map((part) => (typeof part === "string" ? part.trim() : ""))
            .filter(Boolean)
            .join(" ");
        }

        return { enrollmentId: enrollment.id, studentId, parentId, classeId: classe.id, classeName: classe.nameClasse, studentCode, studentEmail: generatedStudentEmail, studentSearchName };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      await appendStudentToOpenClassFiches({
        branchId,
        classId: result.classeId,
        schoolYearId: input.schoolYearId,
        studentId: result.studentId,
      });

      const base = `/admin/organizations/${organizationId}/branches/${branchId}`;
      revalidatePath(`${base}/registration`);
      revalidatePath(`${base}/student`);
      revalidatePath(`${base}/parent`);
      revalidatePath(`${base}/classEnrollment`);
      revalidatePath(`${base}/paiement`);
      return result;
    } catch (error) {
      await Promise.all(createdUserIds.map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)));
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new Error(`Cet ${peopleLabels.studentLower} est déjà inscrit pour cette année scolaire.`);
      throw error;
    }
  });
