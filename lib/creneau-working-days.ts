import type { Day } from "@/prisma/generated/prisma/client";

/** Défaut historique : Lundi → Samedi. */
export const DEFAULT_CRENEAU_WORKING_DAYS: Day[] = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export const CRENEAU_WEEKDAY_OPTIONS: Array<{ value: Day; label: string; short: string }> = [
  { value: "Lundi", label: "Lundi", short: "Lun" },
  { value: "Mardi", label: "Mardi", short: "Mar" },
  { value: "Mercredi", label: "Mercredi", short: "Mer" },
  { value: "Jeudi", label: "Jeudi", short: "Jeu" },
  { value: "Vendredi", label: "Vendredi", short: "Ven" },
  { value: "Samedi", label: "Samedi", short: "Sam" },
];

const DAY_ORDER = new Map(
  CRENEAU_WEEKDAY_OPTIONS.map((d, index) => [d.value, index]),
);

export function normalizeCreneauWorkingDays(
  days: unknown[] | null | undefined,
): Day[] {
  if (!Array.isArray(days) || days.length === 0) {
    return [...DEFAULT_CRENEAU_WORKING_DAYS];
  }
  const allowed = new Set(CRENEAU_WEEKDAY_OPTIONS.map((d) => d.value));
  const unique = [
    ...new Set(
      days.filter((day): day is Day => typeof day === "string" && allowed.has(day as Day)),
    ),
  ];
  if (unique.length === 0) return [...DEFAULT_CRENEAU_WORKING_DAYS];
  return unique.sort(
    (a, b) => (DAY_ORDER.get(a) ?? 99) - (DAY_ORDER.get(b) ?? 99),
  );
}

export function formatCreneauWorkingDaysLabel(
  days: unknown[] | null | undefined,
): string {
  const normalized = normalizeCreneauWorkingDays(days);
  if (
    normalized.length === DEFAULT_CRENEAU_WORKING_DAYS.length &&
    DEFAULT_CRENEAU_WORKING_DAYS.every((d, i) => d === normalized[i])
  ) {
    return "Lun–Sam";
  }
  if (
    normalized.length === 5 &&
    normalized.every((d, i) => d === DEFAULT_CRENEAU_WORKING_DAYS[i])
  ) {
    return "Lun–Ven";
  }
  const shorts = new Map(
    CRENEAU_WEEKDAY_OPTIONS.map((d) => [d.value, d.short]),
  );
  return normalized.map((d) => shorts.get(d) ?? d).join(", ");
}
