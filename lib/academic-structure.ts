export const BRANCH_TYPES = ["PRIMAIRE", "SECONDAIRE"] as const;

export type ManagedBranchType = (typeof BRANCH_TYPES)[number];

export type AcademicPeriodKind = "PERIOD" | "EXAM";

export type AcademicPeriodConfig = {
  key: string;
  label: string;
  groupLabel: string;
  order: number;
  kind: AcademicPeriodKind;
};

export type AcademicGroupConfig = {
  key: string;
  label: string;
  order: number;
  periods: AcademicPeriodConfig[];
};

export type AcademicStructure = {
  typebranch: ManagedBranchType;
  groups: AcademicGroupConfig[];
  periods: AcademicPeriodConfig[];
};

const SECONDARY_GROUPS: AcademicGroupConfig[] = [
  {
    key: "sem1",
    label: "Semestre 1",
    order: 1,
    periods: [
      { key: "p1", label: "1ere Periode", groupLabel: "Semestre 1", order: 1, kind: "PERIOD" },
      { key: "p2", label: "2e Periode", groupLabel: "Semestre 1", order: 2, kind: "PERIOD" },
      { key: "exam1", label: "Examen 1er semestre", groupLabel: "Semestre 1", order: 3, kind: "EXAM" },
    ],
  },
  {
    key: "sem2",
    label: "Semestre 2",
    order: 2,
    periods: [
      { key: "p3", label: "3e Periode", groupLabel: "Semestre 2", order: 4, kind: "PERIOD" },
      { key: "p4", label: "4e Periode", groupLabel: "Semestre 2", order: 5, kind: "PERIOD" },
      { key: "exam2", label: "Examen 2e semestre", groupLabel: "Semestre 2", order: 6, kind: "EXAM" },
    ],
  },
];

const PRIMARY_GROUPS: AcademicGroupConfig[] = [
  {
    key: "trim1",
    label: "1er trimestre",
    order: 1,
    periods: [
      { key: "p1", label: "1ere Periode", groupLabel: "1er trimestre", order: 1, kind: "PERIOD" },
      { key: "p2", label: "2e Periode", groupLabel: "1er trimestre", order: 2, kind: "PERIOD" },
      { key: "exam1", label: "Examen 1er trimestre", groupLabel: "1er trimestre", order: 3, kind: "EXAM" },
    ],
  },
  {
    key: "trim2",
    label: "2e trimestre",
    order: 2,
    periods: [
      { key: "p3", label: "3e Periode", groupLabel: "2e trimestre", order: 4, kind: "PERIOD" },
      { key: "p4", label: "4e Periode", groupLabel: "2e trimestre", order: 5, kind: "PERIOD" },
      { key: "exam2", label: "Examen 2e trimestre", groupLabel: "2e trimestre", order: 6, kind: "EXAM" },
    ],
  },
  {
    key: "trim3",
    label: "3e trimestre",
    order: 3,
    periods: [
      { key: "p5", label: "5e Periode", groupLabel: "3e trimestre", order: 7, kind: "PERIOD" },
      { key: "p6", label: "6e Periode", groupLabel: "3e trimestre", order: 8, kind: "PERIOD" },
      { key: "exam3", label: "Examen 3e trimestre", groupLabel: "3e trimestre", order: 9, kind: "EXAM" },
    ],
  },
];

export const ACADEMIC_STRUCTURES: Record<ManagedBranchType, AcademicStructure> = {
  PRIMAIRE: {
    typebranch: "PRIMAIRE",
    groups: PRIMARY_GROUPS,
    periods: PRIMARY_GROUPS.flatMap((group) => group.periods),
  },
  SECONDAIRE: {
    typebranch: "SECONDAIRE",
    groups: SECONDARY_GROUPS,
    periods: SECONDARY_GROUPS.flatMap((group) => group.periods),
  },
};

export function isManagedBranchType(value: unknown): value is ManagedBranchType {
  return typeof value === "string" && BRANCH_TYPES.includes(value as ManagedBranchType);
}

export function normalizeBranchType(value: unknown): ManagedBranchType {
  return isManagedBranchType(value) ? value : "SECONDAIRE";
}

export function getAcademicStructure(typebranch: unknown): AcademicStructure {
  return ACADEMIC_STRUCTURES[normalizeBranchType(typebranch)];
}

export function getAcademicPeriodLabels(typebranch: unknown): string[] {
  return getAcademicStructure(typebranch).periods.map((period) => period.label);
}

const ACADEMIC_PERIOD_ALIASES: Record<string, string> = {
  "1st Period": "1ere Periode",
  "2nd Period": "2e Periode",
  "3tr Period": "3e Periode",
  "4th Period": "4e Periode",
  "Exam 1st semester": "Examen 1er semestre",
  "Exam 2nd semester": "Examen 2e semestre",
  "1er Periode": "1ere Periode",
  "Exam 1er trimestre": "Examen 1er trimestre",
  "Exam 2e trimestre": "Examen 2e trimestre",
  "Exam 3e trimestre": "Examen 3e trimestre",
};

export function normalizeAcademicPeriodLabel(label: string): string {
  return ACADEMIC_PERIOD_ALIASES[label] ?? label;
}

export function getAcademicPeriodAliases(label: string): string[] {
  const normalized = normalizeAcademicPeriodLabel(label);
  return Object.entries(ACADEMIC_PERIOD_ALIASES)
    .filter(([, target]) => target === normalized)
    .map(([alias]) => alias);
}

export function getAcademicPeriodKey(label: string, typebranch?: unknown): string | null {
  const normalizedLabel = normalizeAcademicPeriodLabel(label);
  const structures = typebranch
    ? [getAcademicStructure(typebranch)]
    : Object.values(ACADEMIC_STRUCTURES);

  for (const structure of structures) {
    const match = structure.periods.find((period) => period.label === normalizedLabel);
    if (match) return match.key;
  }

  return null;
}

export function getAcademicPeriodOrder(label: string, typebranch?: unknown): number {
  const normalizedLabel = normalizeAcademicPeriodLabel(label);
  const structures = typebranch
    ? [getAcademicStructure(typebranch)]
    : Object.values(ACADEMIC_STRUCTURES);

  for (const structure of structures) {
    const match = structure.periods.find((period) => period.label === normalizedLabel);
    if (match) return match.order;
  }

  return Number.MAX_SAFE_INTEGER;
}

export function getActivePeriodKeys(label: string, typebranch?: unknown): string[] {
  const structure = typebranch ? getAcademicStructure(typebranch) : undefined;
  const order = getAcademicPeriodOrder(label, typebranch);
  const periods = structure?.periods ?? Object.values(ACADEMIC_STRUCTURES).flatMap((item) => item.periods);

  return periods
    .filter((period) => period.order <= order)
    .sort((a, b) => a.order - b.order)
    .map((period) => period.key);
}

export function getAcademicGroupLabels(label: string, typebranch?: unknown): string[] {
  const normalizedLabel = normalizeAcademicPeriodLabel(label);
  const structures = typebranch
    ? [getAcademicStructure(typebranch)]
    : Object.values(ACADEMIC_STRUCTURES);

  for (const structure of structures) {
    const group = structure.groups.find((item) =>
      item.periods.some((period) => period.label === normalizedLabel),
    );

    if (group) return group.periods.map((period) => period.label);
  }

  return [label];
}
