import {
  getBranchCapabilities,
  isExtendedBranch,
  type BranchCapability,
} from "@/lib/branch-capabilities";
import {
  normalizeBranchType,
  type ManagedBranchType,
} from "@/lib/academic-structure";
import { isSchoolBranchType } from "@/lib/education-system";

export const CYCLES = [
  "MATERNELLE",
  "PRIMAIRE",
  "SECONDAIRE",
  "ATELIER",
  "CENTRE_FORMATION",
  "UNIVERSITE",
] as const;

export type Cycle = (typeof CYCLES)[number];

export const SCHOOL_CYCLES = [
  "MATERNELLE",
  "PRIMAIRE",
  "SECONDAIRE",
] as const satisfies readonly Cycle[];

export type SchoolCycle = (typeof SCHOOL_CYCLES)[number];

export const CYCLE_SORT_ORDER: Record<Cycle, number> = {
  MATERNELLE: 0,
  PRIMAIRE: 1,
  SECONDAIRE: 2,
  ATELIER: 3,
  CENTRE_FORMATION: 4,
  UNIVERSITE: 5,
};

const MATERNELLE_CAPABILITY: BranchCapability = {
  typebranch: "PRIMAIRE",
  label: "Maternelle",
  shortLabel: "Maternelle",
  studentPolicy: "CREATE_OR_LINK",
  usesSectionOption: false,
  classLabel: "Classe",
  classLabelPlural: "Classes",
  usesBulletin: true,
  usesReleve: false,
  usesBrevet: false,
  usesAttestation: false,
  usesPonderation: true,
  usesFinance: true,
  academicStructureKey: "primary",
  isSchoolBranch: true,
};

export function isCycle(value: unknown): value is Cycle {
  return typeof value === "string" && (CYCLES as readonly string[]).includes(value);
}

export function isSchoolCycle(value: unknown): value is SchoolCycle {
  return (
    typeof value === "string" &&
    (SCHOOL_CYCLES as readonly string[]).includes(value)
  );
}

/** Repli SECONDAIRE si valeur inconnue (même contrat que normalizeBranchType). */
export function normalizeCycle(value: unknown): Cycle {
  if (isCycle(value)) return value;
  return normalizeBranchType(value);
}

export function cycleToManagedType(cycle: unknown) {
  const normalized = normalizeCycle(cycle);
  if (normalized === "MATERNELLE") return "PRIMAIRE" as const;
  return normalizeBranchType(normalized);
}

export type DashboardCycleStat = {
  cycle: Cycle;
  students: number;
  teachers: number;
  classes: number;
  revenue: number;
};

export function buildDashboardCycleStats(input: {
  cycles: readonly Cycle[];
  typebranch: unknown;
  classes: Array<{ cycle?: unknown }>;
  enrollments: Array<{
    studentId: string;
    classe?: { cycle?: unknown } | null;
  }>;
  teachings: Array<{
    teacherId: string;
    classe?: { cycle?: unknown } | null;
  }>;
  payments?: Array<{
    amount: number;
    cycle?: unknown;
  }>;
}): DashboardCycleStat[] {
  const cycles = [...input.cycles];
  if (cycles.length < 2) return [];

  const allowed = new Set(cycles);
  const students = new Map<Cycle, Set<string>>();
  const teachers = new Map<Cycle, Set<string>>();
  const classCounts = new Map<Cycle, number>();
  const revenue = new Map<Cycle, number>();

  for (const cycle of cycles) {
    students.set(cycle, new Set());
    teachers.set(cycle, new Set());
    classCounts.set(cycle, 0);
    revenue.set(cycle, 0);
  }

  const bucket = (cycleValue: unknown): Cycle | null => {
    const cycle = resolveCycle(
      { cycle: cycleValue },
      { typebranch: input.typebranch },
    );
    return allowed.has(cycle) ? cycle : null;
  };

  for (const row of input.classes) {
    const cycle = bucket(row.cycle);
    if (!cycle) continue;
    classCounts.set(cycle, (classCounts.get(cycle) ?? 0) + 1);
  }

  for (const row of input.enrollments) {
    const cycle = bucket(row.classe?.cycle);
    if (!cycle) continue;
    students.get(cycle)?.add(row.studentId);
  }

  for (const row of input.teachings) {
    const cycle = bucket(row.classe?.cycle);
    if (!cycle) continue;
    teachers.get(cycle)?.add(row.teacherId);
  }

  for (const row of input.payments ?? []) {
    const cycle = bucket(row.cycle);
    if (!cycle) continue;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    revenue.set(cycle, (revenue.get(cycle) ?? 0) + amount);
  }

  return cycles.map((cycle) => ({
    cycle,
    students: students.get(cycle)?.size ?? 0,
    teachers: teachers.get(cycle)?.size ?? 0,
    classes: classCounts.get(cycle) ?? 0,
    revenue: revenue.get(cycle) ?? 0,
  }));
}

export function resolveCycle(
  classe?: { cycle?: unknown } | null,
  branch?: { typebranch?: unknown } | null,
): Cycle {
  if (classe?.cycle != null && classe.cycle !== "") {
    return normalizeCycle(classe.cycle);
  }
  return normalizeCycle(branch?.typebranch);
}

export type BranchCycleRecord = {
  cycle: unknown;
  isActive?: boolean;
  sortOrder?: number;
};

export function getBranchCycles(branch: {
  typebranch?: unknown;
  cycles?: BranchCycleRecord[] | null;
}): Cycle[] {
  const rows = (branch.cycles ?? []).filter((row) => row.isActive !== false);
  if (rows.length > 0) {
    return [...rows]
      .sort(
        (a, b) =>
          (a.sortOrder ?? CYCLE_SORT_ORDER[normalizeCycle(a.cycle)]) -
          (b.sortOrder ?? CYCLE_SORT_ORDER[normalizeCycle(b.cycle)]),
      )
      .map((row) => normalizeCycle(row.cycle));
  }
  return [normalizeCycle(branch.typebranch)];
}

export function isMultiCycleBranch(branch: {
  typebranch?: unknown;
  cycles?: BranchCycleRecord[] | null;
}): boolean {
  return getBranchCycles(branch).length > 1;
}

export function getCycleCapabilities(cycle: unknown): BranchCapability {
  if (normalizeCycle(cycle) === "MATERNELLE") {
    return MATERNELLE_CAPABILITY;
  }
  return getBranchCapabilities(cycle);
}

export function cycleLabel(cycle: unknown): string {
  return getCycleCapabilities(cycle).label;
}

/** Libellé court pour badges côte à côte (liste des établissements). */
export function cycleCompactLabel(cycle: unknown): string {
  switch (normalizeCycle(cycle)) {
    case "MATERNELLE":
      return "MAT";
    case "PRIMAIRE":
      return "PRIM";
    case "SECONDAIRE":
      return "SEC";
    default:
      return getCycleCapabilities(cycle).shortLabel;
  }
}

export function cycleSectionLabel(cycle: unknown): string {
  switch (normalizeCycle(cycle)) {
    case "MATERNELLE":
      return "Section maternelle";
    case "PRIMAIRE":
      return "Section primaire";
    case "SECONDAIRE":
      return "Section secondaire";
    default:
      return cycleLabel(cycle);
  }
}

export function isMaternelleCycle(value: unknown): boolean {
  return value === "MATERNELLE";
}

/** Cycle d'inscription : saisi, ou le seul cycle de la branche. */
export function resolveRequestedCycle(input: {
  cycle?: unknown;
  branchCycles?: Cycle[] | null;
  typebranch?: unknown;
}): Cycle {
  const branchCycles =
    input.branchCycles && input.branchCycles.length > 0
      ? input.branchCycles
      : [normalizeCycle(input.typebranch)];

  if (input.cycle != null && input.cycle !== "") {
    const cycle = normalizeCycle(input.cycle);
    if (!branchCycles.includes(cycle)) {
      throw new Error("Ce type de branche n'est pas activé sur cet établissement.");
    }
    return cycle;
  }

  if (branchCycles.length === 1) return branchCycles[0];
  throw new Error(
    "Choisissez d'abord le type de branche (maternelle, primaire ou secondaire).",
  );
}

/** Maternelle et primaire partagent le moteur académique (pas TENAFEP). */
export function isPrimaryLikeCycle(value: unknown): boolean {
  const cycle = normalizeCycle(value);
  return cycle === "PRIMAIRE" || cycle === "MATERNELLE";
}

export function asCycleList(typebranchOrCycles: unknown): Cycle[] {
  if (Array.isArray(typebranchOrCycles)) {
    const list = typebranchOrCycles.map(normalizeCycle);
    return list.length ? list : [normalizeCycle(undefined)];
  }
  return [normalizeCycle(typebranchOrCycles)];
}

export function anyCycle(
  typebranchOrCycles: unknown,
  predicate: (cycle: Cycle) => boolean,
): boolean {
  return asCycleList(typebranchOrCycles).some(predicate);
}

export function everyCycle(
  typebranchOrCycles: unknown,
  predicate: (cycle: Cycle) => boolean,
): boolean {
  return asCycleList(typebranchOrCycles).every(predicate);
}

export function sortSchoolCycles(cycles: readonly SchoolCycle[]): SchoolCycle[] {
  return [...new Set(cycles)].sort(
    (a, b) => CYCLE_SORT_ORDER[a] - CYCLE_SORT_ORDER[b],
  );
}

/** TypeBrache persisté : SECONDAIRE si présent, sinon PRIMAIRE (y compris maternelle seule). */
export function principalTypebranchFromSchoolCycles(
  cycles: readonly SchoolCycle[],
): ManagedBranchType {
  if (cycles.includes("SECONDAIRE")) return "SECONDAIRE";
  return "PRIMAIRE";
}

/** Cycles réellement activés (maternelle seule ≠ PRIMAIRE). */
export function resolveActivatedCycles(input: {
  typebranch?: unknown;
  schoolCycles?: unknown[] | null;
  extraCycles?: unknown[] | null;
}): Cycle[] {
  if (isExtendedBranch(input.typebranch)) {
    return [normalizeCycle(input.typebranch)];
  }

  const school = sortSchoolCycles(
    [...(input.schoolCycles ?? []), ...(input.extraCycles ?? [])].filter(
      isSchoolCycle,
    ),
  );
  if (school.length > 0) return school;

  if (input.typebranch === "MATERNELLE") return ["MATERNELLE"];
  if (isSchoolBranchType(input.typebranch)) {
    return [normalizeCycle(input.typebranch)];
  }
  return [normalizeCycle(input.typebranch)];
}
