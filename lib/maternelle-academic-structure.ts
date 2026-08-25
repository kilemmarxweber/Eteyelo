import type { Prisma } from "@/prisma/generated/prisma/client";
import {
  MATERNELLE_CLASS_LEVELS,
  type MaternelleClassLevel,
} from "@/lib/class-structure";

type AcademicDb = Pick<
  Prisma.TransactionClient,
  "section" | "option" | "classe" | "coursOptionPonderation"
>;

export type MaternelleLevelOption = {
  id: string;
  nameOption: string;
  codeOption: string;
  level: MaternelleClassLevel;
};

export type MaternelleAcademicStructure = {
  section: { id: string; nameSection: string };
  optionsByLevel: Record<MaternelleClassLevel, MaternelleLevelOption>;
  options: MaternelleLevelOption[];
};

export function maternelleLevelOptionCode(level: string): string {
  const folded = level
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (folded === "creche") return "MAT-CRECHE";
  const digit = level.replace(/[ªaèe]/gi, "").trim();
  return `MAT-${digit}`;
}

export function maternelleLevelOptionName(level: MaternelleClassLevel): string {
  return level === "Crèche" ? "Crèche" : `${level}-MATE`;
}

export function isMaternelleClassLevel(
  value: string | null | undefined,
): value is MaternelleClassLevel {
  return (MATERNELLE_CLASS_LEVELS as readonly string[]).includes(value ?? "");
}

export function resolveMaternelleClassLevel(params: {
  level?: string | null;
  nameClasse?: string | null;
}): MaternelleClassLevel | null {
  const blob = `${params.level ?? ""} ${params.nameClasse ?? ""}`;
  if (/-PR\b/i.test(blob) || /\bPRI-/i.test(blob)) return null;
  if (isMaternelleClassLevel(params.level) && !/-PR\b/i.test(params.nameClasse ?? "")) {
    return params.level;
  }
  if (/cr[eè]che/i.test(blob)) return "Crèche";
  if (/\b1è(?:-MATE)?\b/i.test(blob)) return "1è";
  if (/\b2è(?:-MATE)?\b/i.test(blob)) return "2è";
  if (/\b3è(?:-MATE)?\b/i.test(blob)) return "3è";
  return null;
}

export function maternelleOptionDisplayName(level: MaternelleClassLevel): string {
  return level === "Crèche" ? "Crèche" : `${level} année`;
}

/**
 * Garantit section MATERNELLE + une option de pondération par niveau
 * (Crèche, 1è, 2è, 3è). Réassigne les classes maternelles.
 */
export async function ensureMaternelleAcademicStructure(
  db: AcademicDb,
  branchId: string,
): Promise<MaternelleAcademicStructure> {
  let section = await db.section.findFirst({
    where: {
      branchId,
      OR: [
        { codeSection: "MATERNELLE" },
        { nameSection: { equals: "MATERNELLE", mode: "insensitive" } },
      ],
    },
    select: { id: true, nameSection: true, cycle: true },
  });
  if (!section) {
    section = await db.section.create({
      data: {
        branchId,
        codeSection: "MATERNELLE",
        nameSection: "MATERNELLE",
        statusSection: true,
        cycle: "MATERNELLE",
      },
      select: { id: true, nameSection: true, cycle: true },
    });
  } else if (section.cycle !== "MATERNELLE") {
    section = await db.section.update({
      where: { id: section.id },
      data: { cycle: "MATERNELLE", statusSection: true },
      select: { id: true, nameSection: true, cycle: true },
    });
  }

  const optionsByLevel = {} as Record<
    MaternelleClassLevel,
    MaternelleLevelOption
  >;
  const options: MaternelleLevelOption[] = [];

  for (const level of MATERNELLE_CLASS_LEVELS) {
    const codeOption = maternelleLevelOptionCode(level);
    const nameOption = maternelleLevelOptionName(level);

    let option = await db.option.findFirst({
      where: { branchId, codeOption },
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
          codeOption,
          nameOption,
          statusOption: true,
          cycle: "MATERNELLE",
        },
        select: {
          id: true,
          nameOption: true,
          codeOption: true,
          statusOption: true,
        },
      });
    } else if (
      option.nameOption !== nameOption ||
      option.statusOption === false
    ) {
      option = await db.option.update({
        where: { id: option.id },
        data: {
          sectionId: section.id,
          nameOption,
          statusOption: true,
          cycle: "MATERNELLE",
        },
        select: {
          id: true,
          nameOption: true,
          codeOption: true,
          statusOption: true,
        },
      });
    }

    const mapped: MaternelleLevelOption = {
      id: option.id,
      nameOption: option.nameOption,
      codeOption: option.codeOption,
      level,
    };
    optionsByLevel[level] = mapped;
    options.push(mapped);
  }

  const classes = await db.classe.findMany({
    where: {
      branchId,
      OR: [
        { cycle: "MATERNELLE" },
        { nameClasse: { contains: "Crèche" } },
        { nameClasse: { contains: "-MATE" } },
        { nameClasse: { contains: "-MAT" } },
      ],
    },
    select: {
      id: true,
      level: true,
      nameClasse: true,
      optionId: true,
      cycle: true,
    },
  });

  for (const classe of classes) {
    if (classe.cycle && classe.cycle !== "MATERNELLE") continue;
    const level = resolveMaternelleClassLevel({
      level: classe.level,
      nameClasse: classe.nameClasse,
    });
    if (!level) continue;
    const optionId = optionsByLevel[level].id;
    if (classe.optionId === optionId && classe.level === level) continue;
    await db.classe.update({
      where: { id: classe.id },
      data: {
        optionId,
        cycle: "MATERNELLE",
        ...(classe.level !== level ? { level } : {}),
      },
    });
  }

  return { section, optionsByLevel, options };
}

export function getMaternelleOptionForLevel(
  structure: MaternelleAcademicStructure,
  level: string | null | undefined,
): MaternelleLevelOption | null {
  const resolved = resolveMaternelleClassLevel({ level });
  if (!resolved) return null;
  return structure.optionsByLevel[resolved] ?? null;
}
