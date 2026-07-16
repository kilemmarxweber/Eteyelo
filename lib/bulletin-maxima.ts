/**
 * Pure helpers used to calculate bulletin maxima.
 *
 * Historical note.maxScore values always take precedence over the current
 * course configuration. This prevents a ponderation change from rewriting an
 * already created bulletin.
 */

import {
  getAcademicGroupPeriodKeys,
  getAcademicStructure,
  type ManagedBranchType,
} from "@/lib/academic-structure";

export const BULLETIN_PONDERATION_FACTOR = 10;
export const BULLETIN_EXAM_FACTOR = 2;
export const DEFAULT_COURSE_PONDERATION = 1;

export type BulletinPeriodKey =
  | "p1"
  | "p2"
  | "exam1"
  | "p3"
  | "p4"
  | "exam2"
  | "p5"
  | "p6"
  | "exam3";

export type BulletinPeriodMaxima = Partial<
  Record<BulletinPeriodKey, number>
>;

export type BulletinMaxScoreSource = "recorded" | "ponderation" | "fallback";

export type ResolvedBulletinMaxScore = {
  value: number;
  source: BulletinMaxScoreSource;
};

export type ResolveBulletinMaxScoreParams = {
  recordedMaxScore?: unknown;
  ponderation?: unknown;
  isExam?: boolean;
  fallbackPonderation?: number;
};

export type BulletinGroupMaxima = {
  key: string;
  label: string;
  order: number;
  periods: BulletinPeriodMaxima;
  total: number;
};

/** @deprecated Use BulletinGroupMaxima */
export type BulletinSemesterMaxima = Pick<
  BulletinGroupMaxima,
  "periods" | "total"
>;

export type BulletinYearMaxima = {
  groups: BulletinGroupMaxima[];
  annualTotal: number;
};

export function computeTrimesterMaxima(
  maxima: BulletinPeriodMaxima,
  trimesterIndex: 1 | 2 | 3,
): number {
  const year = calculateBulletinYearMaxima(maxima, "PRIMAIRE");
  return getBulletinGroupMaxima(year, trimesterIndex)?.total ?? 0;
}

export function computeYearMaxima(maxima: BulletinPeriodMaxima): number {
  return calculateBulletinYearMaxima(maxima, "PRIMAIRE").annualTotal;
}

export function isValidBulletinMaxScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

export function isValidCoursePonderation(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

/**
 * Resolves one maximum without mutating the fiche or its notes.
 * A recorded maximum is already final, including for an exam, and must not be
 * multiplied again.
 */
export function resolveBulletinMaxScore({
  recordedMaxScore,
  ponderation,
  isExam = false,
  fallbackPonderation = DEFAULT_COURSE_PONDERATION,
}: ResolveBulletinMaxScoreParams): ResolvedBulletinMaxScore {
  if (isValidBulletinMaxScore(recordedMaxScore)) {
    return { value: recordedMaxScore, source: "recorded" };
  }

  const hasConfiguredPonderation = isValidCoursePonderation(ponderation);
  const safeFallback = isValidCoursePonderation(fallbackPonderation)
    ? fallbackPonderation
    : DEFAULT_COURSE_PONDERATION;
  const resolvedPonderation = hasConfiguredPonderation
    ? ponderation
    : safeFallback;

  return {
    value:
      resolvedPonderation *
      BULLETIN_PONDERATION_FACTOR *
      (isExam ? BULLETIN_EXAM_FACTOR : 1),
    source: hasConfiguredPonderation ? "ponderation" : "fallback",
  };
}

/** Adds only finite, non-negative maxima. Invalid values contribute zero. */
export function sumBulletinMaxima(values: Iterable<unknown>): number {
  let total = 0;

  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      total += value;
    }
  }

  return total;
}

export function sumBulletinPeriodMaxima(
  maxima: BulletinPeriodMaxima,
  periodKeys: readonly BulletinPeriodKey[],
): number {
  return sumBulletinMaxima(periodKeys.map((key) => maxima[key]));
}

export function calculateBulletinGroupMaxima(
  maxima: BulletinPeriodMaxima,
  periodKeys: readonly BulletinPeriodKey[],
): BulletinSemesterMaxima {
  const periods = Object.fromEntries(
    periodKeys.map((key) => [
      key,
      typeof maxima[key] === "number" &&
      Number.isFinite(maxima[key]) &&
      maxima[key]! >= 0
        ? maxima[key]
        : 0,
    ]),
  ) as BulletinPeriodMaxima;

  return {
    periods,
    total: sumBulletinPeriodMaxima(periods, periodKeys),
  };
}

/** @deprecated Use calculateBulletinGroupMaxima */
export function calculateBulletinSemesterMaxima(
  maxima: BulletinPeriodMaxima,
  periodKeys: readonly BulletinPeriodKey[],
): BulletinSemesterMaxima {
  return calculateBulletinGroupMaxima(maxima, periodKeys);
}

export function calculateBulletinYearMaxima(
  maxima: BulletinPeriodMaxima,
  typebranch?: ManagedBranchType | unknown,
): BulletinYearMaxima {
  const groups = getAcademicStructure(typebranch).groups.map((group) => {
    const periodKeys = getAcademicGroupPeriodKeys(group) as BulletinPeriodKey[];
    const groupMaxima = calculateBulletinGroupMaxima(maxima, periodKeys);

    return {
      key: group.key,
      label: group.label,
      order: group.order,
      periods: groupMaxima.periods,
      total: groupMaxima.total,
    };
  });

  return {
    groups,
    annualTotal: sumBulletinMaxima(groups.map((group) => group.total)),
  };
}

export function getBulletinGroupMaxima(
  yearMaxima: BulletinYearMaxima,
  groupOrder: number,
): BulletinGroupMaxima | undefined {
  return yearMaxima.groups.find((group) => group.order === groupOrder);
}

/**
 * Adds period maxima from several subjects without assuming that they share
 * the same ponderation.
 */
export function aggregateBulletinPeriodMaxima(
  subjects: Iterable<BulletinPeriodMaxima>,
): BulletinPeriodMaxima {
  const result: BulletinPeriodMaxima = {};

  for (const subject of subjects) {
    for (const [key, value] of Object.entries(subject)) {
      if (!isBulletinPeriodKey(key)) continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        continue;
      }

      result[key] = (result[key] ?? 0) + value;
    }
  }

  return result;
}

export function calculateBulletinPercentage(
  score: unknown,
  maximum: unknown,
): number {
  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    !isValidBulletinMaxScore(maximum)
  ) {
    return 0;
  }

  return (score / maximum) * 100;
}

export function isBulletinPeriodKey(value: string): value is BulletinPeriodKey {
  return (
    value === "p1" ||
    value === "p2" ||
    value === "exam1" ||
    value === "p3" ||
    value === "p4" ||
    value === "exam2" ||
    value === "p5" ||
    value === "p6" ||
    value === "exam3"
  );
}

const BULLETIN_REPRESENTATIVE_PERIOD_KEYS: readonly BulletinPeriodKey[] = [
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "p6",
];

/** Maxima de période utilisé pour trier les blocs (ex. 10, 50, 100). */
export function getBulletinRepresentativePeriodMax(
  maxima: BulletinPeriodMaxima,
  baseMaxScore = 0,
): number {
  for (const key of BULLETIN_REPRESENTATIVE_PERIOD_KEYS) {
    const value = maxima[key];
    if (isValidBulletinMaxScore(value)) {
      return value;
    }
  }

  return isValidBulletinMaxScore(baseMaxScore) ? baseMaxScore : 0;
}

export function compareBulletinRepresentativePeriodMaxima(
  left: BulletinPeriodMaxima,
  right: BulletinPeriodMaxima,
  leftBase = 0,
  rightBase = 0,
): number {
  return (
    getBulletinRepresentativePeriodMax(left, leftBase) -
    getBulletinRepresentativePeriodMax(right, rightBase)
  );
}
