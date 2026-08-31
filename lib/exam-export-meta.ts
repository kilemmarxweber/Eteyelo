import { z } from "zod";

import { normalizeAngolaPrimaryLevel } from "@/lib/angola-primary-structure";
import {
  isAngolaFirstCycleLevel,
  isAngolaSecondarySystem,
  normalizeAngolaSecondaryLevel,
} from "@/lib/angola-secondary-structure";
import { isCtebLevel } from "@/lib/class-structure";
import { normalizeCycle, resolveCycle, type Cycle } from "@/lib/cycle";

/** En-tête administratif du listing Excel finalistes (TENAFEP / 6è). */
export const examExportMetaSchema = z.object({
  province: z.string().trim().max(120).optional().or(z.literal("")),
  provinceCode: z.string().trim().max(20).optional().or(z.literal("")),
  centre: z.string().trim().max(120).optional().or(z.literal("")),
  centreCode: z.string().trim().max(20).optional().or(z.literal("")),
  etablissement: z.string().trim().max(200).optional().or(z.literal("")),
  etablissementCode: z.string().trim().max(40).optional().or(z.literal("")),
  option: z.string().trim().max(120).optional().or(z.literal("")),
  optionCode: z.string().trim().max(20).optional().or(z.literal("")),
  ordre: z.string().trim().max(20).optional().or(z.literal("")),
  gestion: z.string().trim().max(120).optional().or(z.literal("")),
  gestionCode: z.string().trim().max(20).optional().or(z.literal("")),
});

export type ExamExportMeta = z.infer<typeof examExportMetaSchema>;

export const emptyExamExportMeta = (): ExamExportMeta => ({
  province: "",
  provinceCode: "",
  centre: "",
  centreCode: "",
  etablissement: "",
  etablissementCode: "",
  option: "",
  optionCode: "",
  ordre: "",
  gestion: "",
  gestionCode: "",
});

export function parseExamExportMeta(raw: unknown): ExamExportMeta {
  const parsed = examExportMetaSchema.safeParse(raw ?? {});
  return parsed.success
    ? { ...emptyExamExportMeta(), ...parsed.data }
    : emptyExamExportMeta();
}

/** Niveau finaliste primaire (TENAFEP / 6è) — liste sans E13/E80. */
export const PRIMARY_FINALIST_LEVEL = "6è";

/** 8è tronc commun (CTEB) — liste sans E13/E80. */
export const CTEB_FINALIST_LEVEL = "8è";

/** Dernière année Humanités (EXETAT) — seul niveau E13/E80. */
export const SECONDARY_FINALIST_LEVEL = "4è";

export type ExamCodesClassInput = {
  cycle?: unknown;
  typebranch?: unknown;
  level?: string | null;
  className?: string | null;
  classCode?: string | null;
  educationSystem?: unknown;
};

export type ExamCodesActionState = "hidden" | "disabled" | "enabled";

export type ExamCodesStudentLike = {
  classCode?: string | null;
  className?: string | null;
  classLevel?: string | null;
  classCycle?: string | null;
  schoolYearId?: string | null;
  enrollments?: Array<{
    schoolYearId: string;
    classCode?: string | null;
    className?: string | null;
    classLevel?: string | null;
    classCycle?: string | null;
  }>;
};

function classLabelOf(className?: string | null, classCode?: string | null) {
  return `${className ?? ""} ${classCode ?? ""}`.toLowerCase();
}

function inferCycleFromClassLabel(
  className?: string | null,
  classCode?: string | null,
): Cycle | null {
  const label = classLabelOf(className, classCode);
  if (
    label.includes("-mate") ||
    label.includes("creche") ||
    label.includes("crèche")
  ) {
    return "MATERNELLE";
  }
  if (label.includes("-pr")) return "PRIMAIRE";
  return null;
}

function resolveExamCycle(input: ExamCodesClassInput): Cycle {
  if (input.cycle != null && input.cycle !== "") {
    return resolveCycle(
      { cycle: input.cycle },
      { typebranch: input.typebranch },
    );
  }
  return (
    inferCycleFromClassLabel(input.className, input.classCode) ??
    resolveCycle(null, { typebranch: input.typebranch })
  );
}

/** Niveaux autorisés pour E13/E80 : secondaire terminal uniquement. */
export function getExamCodeLevels(
  cycleOrType: unknown,
  educationSystem?: unknown,
): readonly string[] {
  if (cycleOrType === "MATERNELLE") return [];
  const cycle = normalizeCycle(cycleOrType);
  if (cycle === "MATERNELLE" || cycle === "PRIMAIRE") return [];

  switch (cycle) {
    case "SECONDAIRE":
      return isAngolaSecondarySystem("SECONDAIRE", educationSystem)
        ? (["12ª", "13ª"] as const)
        : ([SECONDARY_FINALIST_LEVEL] as const);
    case "UNIVERSITE":
      return ["L3", "M2", "Doctorat"] as const;
    default:
      return [];
  }
}

export function examCodesExistForCycle(
  cycleOrType: unknown,
  educationSystem?: unknown,
): boolean {
  return getExamCodeLevels(cycleOrType, educationSystem).length > 0;
}

function examLevelMatches(
  level: string,
  allowed: readonly string[],
  cycle: Cycle,
  educationSystem?: unknown,
): boolean {
  if (allowed.includes(level)) return true;

  if (cycle === "PRIMAIRE") {
    const angola = normalizeAngolaPrimaryLevel(level);
    if (angola && allowed.includes(angola)) return true;
    if (angola === "6ª" && allowed.includes(PRIMARY_FINALIST_LEVEL)) return true;
  }

  if (cycle === "SECONDAIRE" && isAngolaSecondarySystem("SECONDAIRE", educationSystem)) {
    const angola = normalizeAngolaSecondaryLevel(level);
    return Boolean(angola && allowed.includes(angola));
  }

  return false;
}

export function isPrimaryFinalistClass(classe: {
  level?: string | null;
  nameClasse?: string | null;
  codeClasse?: string | null;
}) {
  if (
    classe.level === PRIMARY_FINALIST_LEVEL ||
    normalizeAngolaPrimaryLevel(classe.level) === "6ª"
  ) {
    return true;
  }
  const name = classLabelOf(classe.nameClasse, classe.codeClasse);
  return (
    name.includes("6è-pr") ||
    name.includes("6e-pr") ||
    name.includes("6ª") ||
    /\b6[èe]\b/.test(name) ||
    name.includes("primaire 6")
  );
}

export function isCtebFinalistClass(classe: {
  level?: string | null;
  nameClasse?: string | null;
  codeClasse?: string | null;
}) {
  const level = classe.level?.trim() ?? "";
  if (level === CTEB_FINALIST_LEVEL || level === "8e") return true;
  if (normalizeAngolaSecondaryLevel(level) === "8ª") return true;
  const name = classLabelOf(classe.nameClasse, classe.codeClasse);
  return (
    name.includes("8è-") ||
    name.includes("8e-") ||
    name.includes("8ª") ||
    /\b8[èe]\b/.test(name)
  );
}

export function isExamCodesClass(input: ExamCodesClassInput): boolean {
  const cycle = resolveExamCycle(input);
  if (cycle === "MATERNELLE" || cycle === "PRIMAIRE") return false;

  const allowed = getExamCodeLevels(cycle, input.educationSystem);
  if (allowed.length === 0) return false;

  const level = input.level?.trim() ?? "";
  if (isCtebLevel(level) || isAngolaFirstCycleLevel(level)) return false;

  if (level && examLevelMatches(level, allowed, cycle, input.educationSystem)) {
    return true;
  }

  if (cycle === "SECONDAIRE") {
    if (
      isCtebFinalistClass({
        level: input.level,
        nameClasse: input.className,
        codeClasse: input.classCode,
      })
    ) {
      return false;
    }
    const name = classLabelOf(input.className, input.classCode);
    return (
      name.includes("4è-") ||
      name.includes("4e-") ||
      /\b4[èe]\b/.test(name) ||
      name.includes("12ª") ||
      name.includes("13ª")
    );
  }

  return false;
}

/** Classes listées comme finalistes : 6è primaire, 8è tronc commun, 4è secondaire. */
export function isFinalistListingClass(input: ExamCodesClassInput): boolean {
  const cycle = resolveExamCycle(input);
  const classe = {
    level: input.level,
    nameClasse: input.className,
    codeClasse: input.classCode,
  };
  if (cycle === "PRIMAIRE") return isPrimaryFinalistClass(classe);
  if (cycle === "SECONDAIRE") {
    return isCtebFinalistClass(classe) || isExamCodesClass(input);
  }
  return false;
}

export function pickStudentExamEnrollment(
  student: ExamCodesStudentLike,
  schoolYearIds?: string[] | null,
) {
  if (schoolYearIds?.length === 1) {
    return (
      student.enrollments?.find(
        (enrollment) => enrollment.schoolYearId === schoolYearIds[0],
      ) ?? null
    );
  }
  if (student.schoolYearId) {
    const current = student.enrollments?.find(
      (enrollment) => enrollment.schoolYearId === student.schoolYearId,
    );
    if (current) return current;
  }
  return student.enrollments?.[0] ?? null;
}

function examCodesInputFromStudent(
  student: ExamCodesStudentLike,
  options: {
    typebranch?: unknown;
    educationSystem?: unknown;
    schoolYearIds?: string[] | null;
  },
): ExamCodesClassInput {
  const enrollment = pickStudentExamEnrollment(student, options.schoolYearIds);
  return {
    cycle: enrollment?.classCycle ?? student.classCycle,
    typebranch: options.typebranch,
    level: enrollment?.classLevel ?? student.classLevel,
    className: enrollment?.className ?? student.className,
    classCode: enrollment?.classCode ?? student.classCode,
    educationSystem: options.educationSystem,
  };
}

export function studentAllowsExamCodes(
  student: ExamCodesStudentLike,
  options: {
    typebranch?: unknown;
    educationSystem?: unknown;
    schoolYearIds?: string[] | null;
  },
): boolean {
  return isExamCodesClass(examCodesInputFromStudent(student, options));
}

/** Maternelle / primaire / CTEB : pas d'E13-E80. Secondaire : terminal uniquement. */
export function getStudentExamCodesActionState(
  student: ExamCodesStudentLike,
  options: {
    typebranch?: unknown;
    educationSystem?: unknown;
    schoolYearIds?: string[] | null;
  },
): ExamCodesActionState {
  const input = examCodesInputFromStudent(student, options);
  const cycle = resolveExamCycle(input);
  if (!examCodesExistForCycle(cycle, options.educationSystem)) return "hidden";
  const level = input.level?.trim() ?? "";
  if (isCtebLevel(level) || isAngolaFirstCycleLevel(level)) return "hidden";
  return isExamCodesClass(input) ? "enabled" : "disabled";
}
