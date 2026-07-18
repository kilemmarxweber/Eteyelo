import { UNIVERSITY_LMD_LABELS } from "@/lib/university-lmd-labels";

export const BRANCH_TYPES = [
  "PRIMAIRE",
  "SECONDAIRE",
  "ATELIER",
  "CENTRE_FORMATION",
  "UNIVERSITE",
] as const;

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

const WORKSHOP_GROUPS: AcademicGroupConfig[] = [
  {
    key: "session",
    label: "Session",
    order: 1,
    periods: [
      {
        key: "p1",
        label: "Session pratique",
        groupLabel: "Session",
        order: 1,
        kind: "PERIOD",
      },
    ],
  },
];

const TRAINING_GROUPS: AcademicGroupConfig[] = [
  {
    key: "mod1",
    label: "Module 1",
    order: 1,
    periods: [
      { key: "p1", label: "Periode 1", groupLabel: "Module 1", order: 1, kind: "PERIOD" },
      { key: "p2", label: "Periode 2", groupLabel: "Module 1", order: 2, kind: "PERIOD" },
      { key: "exam1", label: "Evaluation module 1", groupLabel: "Module 1", order: 3, kind: "EXAM" },
    ],
  },
  {
    key: "mod2",
    label: "Module 2",
    order: 2,
    periods: [
      { key: "p3", label: "Periode 3", groupLabel: "Module 2", order: 4, kind: "PERIOD" },
      { key: "exam2", label: "Evaluation finale", groupLabel: "Module 2", order: 5, kind: "EXAM" },
    ],
  },
];

/** Calendrier ESU / LMD (RDC) : 2 semestres par année académique. */
const UNIVERSITY_LMD_GROUPS: AcademicGroupConfig[] = [
  {
    key: "sem1",
    label: UNIVERSITY_LMD_LABELS.firstSemester,
    order: 1,
    periods: [
      {
        key: "cours1",
        label: UNIVERSITY_LMD_LABELS.courses,
        groupLabel: UNIVERSITY_LMD_LABELS.firstSemester,
        order: 1,
        kind: "PERIOD",
      },
      {
        key: "eval1",
        label: UNIVERSITY_LMD_LABELS.evaluations,
        groupLabel: UNIVERSITY_LMD_LABELS.firstSemester,
        order: 2,
        kind: "PERIOD",
      },
      {
        key: "session1",
        label: UNIVERSITY_LMD_LABELS.firstSession,
        groupLabel: UNIVERSITY_LMD_LABELS.firstSemester,
        order: 3,
        kind: "EXAM",
      },
      {
        key: "delib1",
        label: UNIVERSITY_LMD_LABELS.deliberations,
        groupLabel: UNIVERSITY_LMD_LABELS.firstSemester,
        order: 4,
        kind: "PERIOD",
      },
    ],
  },
  {
    key: "sem2",
    label: UNIVERSITY_LMD_LABELS.secondSemester,
    order: 2,
    periods: [
      {
        key: "cours2",
        label: UNIVERSITY_LMD_LABELS.courses,
        groupLabel: UNIVERSITY_LMD_LABELS.secondSemester,
        order: 5,
        kind: "PERIOD",
      },
      {
        key: "eval2",
        label: UNIVERSITY_LMD_LABELS.evaluations,
        groupLabel: UNIVERSITY_LMD_LABELS.secondSemester,
        order: 6,
        kind: "PERIOD",
      },
      {
        key: "session2",
        label: UNIVERSITY_LMD_LABELS.firstSession,
        groupLabel: UNIVERSITY_LMD_LABELS.secondSemester,
        order: 7,
        kind: "EXAM",
      },
      {
        key: "rattrapage",
        label: UNIVERSITY_LMD_LABELS.secondSession,
        groupLabel: UNIVERSITY_LMD_LABELS.secondSemester,
        order: 8,
        kind: "EXAM",
      },
      {
        key: "defense",
        label: UNIVERSITY_LMD_LABELS.defense,
        groupLabel: UNIVERSITY_LMD_LABELS.secondSemester,
        order: 9,
        kind: "EXAM",
      },
      {
        key: "delib2",
        label: UNIVERSITY_LMD_LABELS.deliberations,
        groupLabel: UNIVERSITY_LMD_LABELS.secondSemester,
        order: 10,
        kind: "PERIOD",
      },
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
  ATELIER: {
    typebranch: "ATELIER",
    groups: WORKSHOP_GROUPS,
    periods: WORKSHOP_GROUPS.flatMap((group) => group.periods),
  },
  CENTRE_FORMATION: {
    typebranch: "CENTRE_FORMATION",
    groups: TRAINING_GROUPS,
    periods: TRAINING_GROUPS.flatMap((group) => group.periods),
  },
  UNIVERSITE: {
    typebranch: "UNIVERSITE",
    groups: UNIVERSITY_LMD_GROUPS,
    periods: UNIVERSITY_LMD_GROUPS.flatMap((group) => group.periods),
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
  // Anciens libelles universite LMD → appellations ESU actuelles
  "Évaluations (1er semestre)": UNIVERSITY_LMD_LABELS.evaluations,
  "Évaluations (2e semestre)": UNIVERSITY_LMD_LABELS.evaluations,
  "Examen (1re session — 1er semestre)": UNIVERSITY_LMD_LABELS.firstSession,
  "Examen (1re session — 2e semestre)": UNIVERSITY_LMD_LABELS.firstSession,
  "Délibérations (1er semestre)": UNIVERSITY_LMD_LABELS.deliberations,
  "Délibérations (2e semestre)": UNIVERSITY_LMD_LABELS.deliberations,
  "2e session (Rattrapage)": UNIVERSITY_LMD_LABELS.secondSession,
  "Défense TFC / Mémoire": UNIVERSITY_LMD_LABELS.defense,
  "1re session (examens ordinaires)": UNIVERSITY_LMD_LABELS.firstSession,
  "2e session (rattrapage)": UNIVERSITY_LMD_LABELS.secondSession,
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

/** Clés de stockage dans TypeFiche (sem1, sem2, sem3). */
export type StorageGroupKey = "sem1" | "sem2" | "sem3";

export type AcademicGroupTotalKey = "tt1" | "tt2" | "tt3";

export type AcademicPeriodField =
  | "p1"
  | "p2"
  | "p3"
  | "p4"
  | "p5"
  | "p6"
  | "exam1"
  | "exam2"
  | "exam3"
  | AcademicGroupTotalKey
  | "tg";

export type PeriodFieldMapEntry = {
  storageKey: StorageGroupKey;
  field: AcademicPeriodField;
};

export function getStorageGroupKey(group: AcademicGroupConfig): StorageGroupKey {
  return `sem${group.order}` as StorageGroupKey;
}

export function getAcademicGroupTotalKey(groupOrder: number): AcademicGroupTotalKey {
  return `tt${groupOrder}` as AcademicGroupTotalKey;
}

export function getAcademicGroupPeriodKeys(group: AcademicGroupConfig): string[] {
  return group.periods.map((period) => period.key);
}

export function getAcademicGroupByOrder(
  typebranch: unknown,
  groupOrder: number,
): AcademicGroupConfig | undefined {
  return getAcademicStructure(typebranch).groups.find(
    (group) => group.order === groupOrder,
  );
}

export function getAcademicGroupByPeriodKey(
  periodKey: string,
  typebranch?: unknown,
): AcademicGroupConfig | undefined {
  const structures = typebranch
    ? [getAcademicStructure(typebranch)]
    : Object.values(ACADEMIC_STRUCTURES);

  for (const structure of structures) {
    const group = structure.groups.find((item) =>
      item.periods.some((period) => period.key === periodKey),
    );
    if (group) return group;
  }

  return undefined;
}

export function getPeriodStorageGroupKey(
  periodKey: string,
  typebranch?: unknown,
): StorageGroupKey | undefined {
  const group = getAcademicGroupByPeriodKey(periodKey, typebranch);
  return group ? getStorageGroupKey(group) : undefined;
}

export function getGroupPeriodOrder(
  typebranch: unknown,
  groupOrder: number,
): readonly AcademicPeriodField[] {
  const group = getAcademicGroupByOrder(typebranch, groupOrder);
  if (!group) return [];

  return [
    ...group.periods.map((period) => period.key as AcademicPeriodField),
    getAcademicGroupTotalKey(group.order),
  ];
}

export function getGroupPeriodLabels(group: AcademicGroupConfig): string[] {
  return group.periods.map((period) => period.label);
}

export function getGroupPeriodLabelAliases(label: string): string[] {
  const normalized = normalizeAcademicPeriodLabel(label);
  const aliases = getAcademicPeriodAliases(normalized);
  return [normalized, ...aliases];
}

export function buildPeriodFieldMap(
  typebranch: unknown,
): Record<string, PeriodFieldMapEntry> {
  const structure = getAcademicStructure(typebranch);
  const map: Record<string, PeriodFieldMapEntry> = {};

  for (const group of structure.groups) {
    const storageKey = getStorageGroupKey(group);

    for (const period of group.periods) {
      const entry: PeriodFieldMapEntry = {
        storageKey,
        field: period.key as AcademicPeriodField,
      };

      map[period.label] = entry;
      for (const alias of getAcademicPeriodAliases(period.label)) {
        map[alias] = entry;
      }
    }
  }

  return map;
}

export function isAcademicGroupComplete(
  periods: Array<{ periodName: string }>,
  group: AcademicGroupConfig,
): boolean {
  const periodNames = new Set(periods.map((period) => period.periodName));

  return getGroupPeriodLabels(group).every((label) =>
    getGroupPeriodLabelAliases(label).some((alias) => periodNames.has(alias)),
  );
}

export function areAllAcademicGroupsComplete(
  periods: Array<{ periodName: string }>,
  typebranch: unknown,
): boolean {
  return getAcademicStructure(typebranch).groups.every((group) =>
    isAcademicGroupComplete(periods, group),
  );
}

export function filterPeriodsForGroup<T extends { periodName: string }>(
  periods: readonly T[],
  group: AcademicGroupConfig,
): T[] {
  const aliases = new Set(
    getGroupPeriodLabels(group).flatMap((label) =>
      getGroupPeriodLabelAliases(label),
    ),
  );

  return periods.filter((period) => aliases.has(period.periodName));
}

export function getAcademicGroupExamLabel(group: AcademicGroupConfig): string {
  return group.periods.find((period) => period.kind === "EXAM")?.label ?? "";
}

export function isAcademicExamPeriodName(
  periodName: string,
  typebranch?: unknown,
): boolean {
  const periodKey = getAcademicPeriodKey(periodName, typebranch);
  if (!periodKey) return false;

  const group = getAcademicGroupByPeriodKey(periodKey, typebranch);
  if (!group) return false;

  return group.periods.some(
    (period) => period.key === periodKey && period.kind === "EXAM",
  );
}

/** Scores vides par groupe (sem1/sem2/sem3) selon le type de branche. */
export function buildEmptySubjectGroupScores(
  typebranch?: unknown,
): Partial<Record<StorageGroupKey, Record<string, number>>> {
  const structure = getAcademicStructure(typebranch);
  const groups: Partial<Record<StorageGroupKey, Record<string, number>>> = {};

  for (const group of structure.groups) {
    const storageKey = getStorageGroupKey(group);
    groups[storageKey] = Object.fromEntries(
      group.periods.map((period) => [period.key, 0]),
    );
  }

  return groups;
}
