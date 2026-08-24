import type { Prisma } from "@/prisma/generated/prisma/client";
import {
  PRIMARY_CLASS_LEVELS,
  type PrimaryClassLevel,
} from "@/lib/class-structure";
import { angolaPrimaryToDrcLevel } from "@/lib/angola-primary-structure";

type AcademicDb = Pick<
  Prisma.TransactionClient,
  "section" | "option" | "classe" | "coursOptionPonderation"
>;

export type PrimaryLevelOption = {
  id: string;
  nameOption: string;
  codeOption: string;
  level: PrimaryClassLevel;
};

export type PrimaryAcademicStructure = {
  section: { id: string; nameSection: string };
  /** Options 1è–6è (pondération par niveau). */
  optionsByLevel: Record<PrimaryClassLevel, PrimaryLevelOption>;
  options: PrimaryLevelOption[];
  /** @deprecated Ancienne option unique — conservée désactivée si elle existait. */
  legacyOption: { id: string; nameOption: string } | null;
};

/** Code option pour un niveau primaire (ex. 1è → PRI-1). */
export function primaryLevelOptionCode(level: string): string {
  const digit = level.replace(/[ªaèe]/gi, "").trim();
  return `PRI-${digit}`;
}

export function primaryLevelOptionName(level: PrimaryClassLevel): string {
  return level;
}

export function isPrimaryClassLevel(
  value: string | null | undefined,
): value is PrimaryClassLevel {
  return (PRIMARY_CLASS_LEVELS as readonly string[]).includes(value ?? "");
}

/** Extrait le niveau depuis level ou le nom de classe (ex. 3è-PR A). */
export function resolvePrimaryClassLevel(params: {
  level?: string | null;
  nameClasse?: string | null;
}): PrimaryClassLevel | null {
  if (isPrimaryClassLevel(params.level)) return params.level;
  const mapped = angolaPrimaryToDrcLevel(params.level);
  if (mapped) return mapped;
  const fromName = params.nameClasse?.match(/^(1è|2è|3è|4è|5è|6è|1ª|2ª|3ª|4ª|5ª|6ª)/)?.[1];
  if (isPrimaryClassLevel(fromName)) return fromName;
  return angolaPrimaryToDrcLevel(fromName);
}

/**
 * Garantit section PRIMAIRE + une option de pondération par niveau (1è–6è).
 * Réassigne les classes sur l'option correspondant à leur niveau.
 */
export async function ensurePrimaryAcademicStructure(
  db: AcademicDb,
  branchId: string,
): Promise<PrimaryAcademicStructure> {
  let section = await db.section.findFirst({
    where: { branchId, nameSection: { equals: "PRIMAIRE", mode: "insensitive" } },
    select: { id: true, nameSection: true },
  });
  if (!section) {
    section = await db.section.create({
      data: {
        branchId,
        codeSection: "PRIMAIRE",
        nameSection: "PRIMAIRE",
        statusSection: true,
      },
      select: { id: true, nameSection: true },
    });
  }

  const optionsByLevel = {} as Record<PrimaryClassLevel, PrimaryLevelOption>;
  const options: PrimaryLevelOption[] = [];

  for (const level of PRIMARY_CLASS_LEVELS) {
    const codeOption = primaryLevelOptionCode(level);
    const nameOption = primaryLevelOptionName(level);

    let option = await db.option.findFirst({
      where: {
        branchId,
        OR: [
          { codeOption },
          { nameOption: { equals: nameOption, mode: "insensitive" } },
        ],
      },
      select: { id: true, nameOption: true, codeOption: true, statusOption: true },
    });

    if (!option) {
      option = await db.option.create({
        data: {
          branchId,
          sectionId: section.id,
          codeOption,
          nameOption,
          statusOption: true,
        },
        select: {
          id: true,
          nameOption: true,
          codeOption: true,
          statusOption: true,
        },
      });
    } else if (
      option.codeOption !== codeOption ||
      option.nameOption !== nameOption ||
      option.statusOption === false
    ) {
      option = await db.option.update({
        where: { id: option.id },
        data: {
          sectionId: section.id,
          codeOption,
          nameOption,
          statusOption: true,
        },
        select: {
          id: true,
          nameOption: true,
          codeOption: true,
          statusOption: true,
        },
      });
    }

    const mapped: PrimaryLevelOption = {
      id: option.id,
      nameOption: option.nameOption,
      codeOption: option.codeOption,
      level,
    };
    optionsByLevel[level] = mapped;
    options.push(mapped);
  }

  // Désactive l'ancienne option unique "PRIMAIRE" (plus utilisée pour les classes).
  const legacy = await db.option.findFirst({
    where: {
      branchId,
      OR: [
        { codeOption: "PRIMAIRE" },
        { nameOption: { equals: "PRIMAIRE", mode: "insensitive" } },
      ],
      NOT: {
        id: { in: options.map((o) => o.id) },
      },
    },
    select: { id: true, nameOption: true },
  });
  if (legacy) {
    await db.option.update({
      where: { id: legacy.id },
      data: { statusOption: false },
    });
  }

  // Réassigne chaque classe au niveau correspondant.
  const classes = await db.classe.findMany({
    where: { branchId },
    select: { id: true, level: true, nameClasse: true, optionId: true },
  });

  for (const classe of classes) {
    const level = resolvePrimaryClassLevel({
      level: classe.level,
      nameClasse: classe.nameClasse,
    });
    if (!level) continue;
    const optionId = optionsByLevel[level].id;
    if (classe.optionId === optionId) continue;
    await db.classe.update({
      where: { id: classe.id },
      data: {
        optionId,
        ...(classe.level !== level ? { level } : {}),
      },
    });
  }

  // Recopie les pondérations de l'ancienne option unique vers chaque niveau (si vide).
  if (legacy) {
    const legacyWeights = await db.coursOptionPonderation.findMany({
      where: { branchId, optionId: legacy.id },
      select: { coursId: true, ponderation: true },
    });
    if (legacyWeights.length > 0) {
      for (const levelOption of options) {
        for (const weight of legacyWeights) {
          const existing = await db.coursOptionPonderation.findFirst({
            where: {
              branchId,
              coursId: weight.coursId,
              optionId: levelOption.id,
            },
            select: { id: true },
          });
          if (existing) continue;
          await db.coursOptionPonderation.create({
            data: {
              branchId,
              coursId: weight.coursId,
              optionId: levelOption.id,
              ponderation: weight.ponderation,
            },
          });
        }
      }
    }
  }

  return {
    section,
    optionsByLevel,
    options,
    legacyOption: legacy,
  };
}

export function getPrimaryOptionForLevel(
  structure: PrimaryAcademicStructure,
  level: string | null | undefined,
): PrimaryLevelOption | null {
  if (isPrimaryClassLevel(level)) {
    return structure.optionsByLevel[level] ?? null;
  }
  const mapped = angolaPrimaryToDrcLevel(level);
  if (!mapped) return null;
  return structure.optionsByLevel[mapped] ?? null;
}
