import type { Prisma } from "@/prisma/generated/prisma/client";
import { generateCode, ensureUniqueIdentifier } from "@/lib/generated-identifiers";
import { ensurePracticalDomainsForBranch } from "@/lib/branch-practical-domains";
import { DEFAULT_CRENEAU_WORKING_DAYS } from "@/lib/creneau-working-days";

type AcademicDb = Pick<
  Prisma.TransactionClient,
  | "section"
  | "option"
  | "classe"
  | "typeFrais"
  | "practicalDomain"
  | "room"
  | "creneau"
>;

export const WORKSHOP_SECTION_CODE = "ATELIER";
export const WORKSHOP_OPTION_CODE = "ATL-GROUPE";
export const WORKSHOP_OPTION_NAME = "Groupe";
export const WORKSHOP_FEE_TYPE_NAME = "Frais atelier";
/** Vacation matin (avant-midi) — sans récréation. */
export const WORKSHOP_CRENEAU_NAME = "Vacation atelier — Matin";
export const WORKSHOP_CRENEAU_NAME_SOIR = "Vacation atelier — Soir";
export const WORKSHOP_CRENEAU_LEGACY_NAMES = [
  "Vacation atelier",
  "ATELIER",
] as const;

export type WorkshopAcademicStructure = {
  section: { id: string; nameSection: string };
  option: { id: string; nameOption: string; codeOption: string };
  creneau: { id: string; nameCreneau: string };
  creneauSoir: { id: string; nameCreneau: string };
};

function workshopTimeUtc(hours: number, minutes = 0) {
  return new Date(Date.UTC(2000, 0, 1, hours, minutes, 0, 0));
}

async function ensureWorkshopCreneauSlot(
  db: AcademicDb,
  branchId: string,
  params: {
    name: string;
    legacyNames?: readonly string[];
    startH: number;
    startM: number;
    endH: number;
    endM: number;
    durationCourse: number;
  },
): Promise<{ id: string; nameCreneau: string }> {
  const nameMatchers = [
    params.name,
    ...(params.legacyNames ?? []),
  ];

  let creneau = await db.creneau.findFirst({
    where: {
      branchId,
      isArchived: false,
      OR: nameMatchers.map((name) => ({
        nameCreneau: { equals: name, mode: "insensitive" as const },
      })),
    },
    select: {
      id: true,
      nameCreneau: true,
      recreationDuration: true,
      durationCourse: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!creneau) {
    creneau = await db.creneau.create({
      data: {
        branchId,
        nameCreneau: params.name,
        startTime: workshopTimeUtc(params.startH, params.startM),
        endTime: workshopTimeUtc(params.endH, params.endM),
        durationCourse: params.durationCourse,
        recreationDuration: 0,
        recreationHour: workshopTimeUtc(params.startH, params.startM),
        workingDays: DEFAULT_CRENEAU_WORKING_DAYS,
      },
      select: {
        id: true,
        nameCreneau: true,
        recreationDuration: true,
        durationCourse: true,
      },
    });
  } else {
    const needsUpdate =
      creneau.nameCreneau !== params.name ||
      (creneau.recreationDuration ?? 0) > 0 ||
      (creneau.durationCourse ?? 0) < 60;
    if (needsUpdate) {
      creneau = await db.creneau.update({
        where: { id: creneau.id },
        data: {
          nameCreneau: params.name,
          startTime: workshopTimeUtc(params.startH, params.startM),
          endTime: workshopTimeUtc(params.endH, params.endM),
          durationCourse: Math.max(
            creneau.durationCourse ?? params.durationCourse,
            params.durationCourse,
          ),
          recreationDuration: 0,
          recreationHour: workshopTimeUtc(params.startH, params.startM),
        },
        select: {
          id: true,
          nameCreneau: true,
          recreationDuration: true,
          durationCourse: true,
        },
      });
    }
  }

  return { id: creneau.id, nameCreneau: creneau.nameCreneau };
}

/**
 * Vacations atelier matin + soir, sans récréation.
 * Les groupes sans vacation sont rattachés au créneau matin.
 */
export async function ensureWorkshopCreneau(
  db: AcademicDb,
  branchId: string,
): Promise<{
  matin: { id: string; nameCreneau: string };
  soir: { id: string; nameCreneau: string };
}> {
  const matin = await ensureWorkshopCreneauSlot(db, branchId, {
    name: WORKSHOP_CRENEAU_NAME,
    legacyNames: WORKSHOP_CRENEAU_LEGACY_NAMES,
    startH: 7,
    startM: 30,
    endH: 13,
    endM: 30,
    durationCourse: 360,
  });

  const soir = await ensureWorkshopCreneauSlot(db, branchId, {
    name: WORKSHOP_CRENEAU_NAME_SOIR,
    startH: 13,
    startM: 30,
    endH: 19,
    endM: 30,
    durationCourse: 360,
  });

  await db.classe.updateMany({
    where: {
      branchId,
      creneauId: null,
      OR: [{ cycle: "ATELIER" }, { cycle: null, level: "Groupe" }],
    },
    data: { creneauId: matin.id },
  });

  return { matin, soir };
}

/**
 * Garantit section + option internes + vacation atelier (sans récréation).
 * Réassigne les groupes atelier sur cette option.
 */
export async function ensureWorkshopAcademicStructure(
  db: AcademicDb,
  branchId: string,
): Promise<WorkshopAcademicStructure> {
  let section = await db.section.findFirst({
    where: {
      branchId,
      OR: [
        { codeSection: WORKSHOP_SECTION_CODE },
        { nameSection: { equals: "ATELIER", mode: "insensitive" } },
      ],
    },
    select: { id: true, nameSection: true, cycle: true },
  });

  if (!section) {
    section = await db.section.create({
      data: {
        branchId,
        codeSection: WORKSHOP_SECTION_CODE,
        nameSection: "ATELIER",
        statusSection: true,
        cycle: "ATELIER",
      },
      select: { id: true, nameSection: true, cycle: true },
    });
  } else if (section.cycle !== "ATELIER") {
    section = await db.section.update({
      where: { id: section.id },
      data: { cycle: "ATELIER" },
      select: { id: true, nameSection: true, cycle: true },
    });
  }

  let option = await db.option.findFirst({
    where: {
      branchId,
      OR: [
        { codeOption: WORKSHOP_OPTION_CODE },
        {
          nameOption: { equals: WORKSHOP_OPTION_NAME, mode: "insensitive" },
          cycle: "ATELIER",
        },
      ],
    },
    select: {
      id: true,
      nameOption: true,
      codeOption: true,
      statusOption: true,
    },
  });

  if (!option) {
    option = await db.option.create({
      data: {
        branchId,
        sectionId: section.id,
        codeOption: WORKSHOP_OPTION_CODE,
        nameOption: WORKSHOP_OPTION_NAME,
        statusOption: true,
        cycle: "ATELIER",
      },
      select: { id: true, nameOption: true, codeOption: true, statusOption: true },
    });
  } else if (
    option.codeOption !== WORKSHOP_OPTION_CODE ||
    option.nameOption !== WORKSHOP_OPTION_NAME ||
    option.statusOption === false
  ) {
    option = await db.option.update({
      where: { id: option.id },
      data: {
        sectionId: section.id,
        codeOption: WORKSHOP_OPTION_CODE,
        nameOption: WORKSHOP_OPTION_NAME,
        statusOption: true,
        cycle: "ATELIER",
      },
      select: { id: true, nameOption: true, codeOption: true, statusOption: true },
    });
  }

  const classes = await db.classe.findMany({
    where: {
      branchId,
      OR: [{ cycle: "ATELIER" }, { cycle: null, level: "Groupe" }],
    },
    select: { id: true, optionId: true, cycle: true, level: true },
  });

  for (const classe of classes) {
    if (classe.optionId === option.id && classe.cycle === "ATELIER") continue;
    await db.classe.update({
      where: { id: classe.id },
      data: {
        optionId: option.id,
        cycle: "ATELIER",
        ...(classe.level !== "Groupe" ? { level: "Groupe" } : {}),
      },
    });
  }

  await ensureWorkshopFeeType(db, branchId);
  await ensurePracticalDomainsForBranch(db, branchId);
  const { matin, soir } = await ensureWorkshopCreneau(db, branchId);

  return {
    section: { id: section.id, nameSection: section.nameSection },
    option: {
      id: option.id,
      nameOption: option.nameOption,
      codeOption: option.codeOption,
    },
    creneau: matin,
    creneauSoir: soir,
  };
}

export async function ensureWorkshopFeeType(db: AcademicDb, branchId: string) {
  const existing = await db.typeFrais.findFirst({
    where: {
      branchId,
      nameType: { equals: WORKSHOP_FEE_TYPE_NAME, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) return existing;

  const codeType = await ensureUniqueIdentifier({
    base: generateCode(WORKSHOP_FEE_TYPE_NAME, "FA", 16),
    separator: "",
    exists: async (value) =>
      Boolean(
        await db.typeFrais.findUnique({
          where: { codeType: value },
          select: { id: true },
        }),
      ),
  });

  return db.typeFrais.create({
    data: {
      branchId,
      codeType,
      nameType: WORKSHOP_FEE_TYPE_NAME,
      description: "Frais de participation à l'atelier pratique",
      statusType: true,
      cycle: "ATELIER",
    },
    select: { id: true },
  });
}
