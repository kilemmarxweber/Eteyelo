import {
  getAcademicStructure,
  type AcademicPeriodKind,
} from "@/lib/academic-structure";
import type { Cycle } from "@/lib/cycle";

/**
 * Durée d'une « heure » de charge (unité contractuelle) :
 * primaire / maternelle = 30 min, secondaire = 45 min.
 */
export function teachingHourUnitMinutes(cycle: Cycle): number {
  if (cycle === "MATERNELLE" || cycle === "PRIMAIRE") return 30;
  if (cycle === "SECONDAIRE") return 45;
  return 45;
}

/** Minutes planifiées = somme des durées de séance (créneau) de chaque créneau. */
export function sumScheduleMinutes(
  entries: Array<{ creneauId: string | null }>,
  durationByCreneauId: Map<string, number>,
  fallbackMinutes: number,
): number {
  let total = 0;
  for (const entry of entries) {
    const fromCreneau = entry.creneauId
      ? durationByCreneauId.get(entry.creneauId)
      : undefined;
    const minutes =
      fromCreneau != null && fromCreneau > 0 ? fromCreneau : fallbackMinutes;
    total += minutes;
  }
  return total;
}

/** Charge en heures : totalMinutes / unité (ex. 240 / 30 = 8). */
export function teachingHoursFromMinutes(
  totalMinutes: number,
  hourUnitMinutes: number,
): number {
  if (!(totalMinutes > 0) || !(hourUnitMinutes > 0)) return 0;
  return Math.round((totalMinutes / hourUnitMinutes) * 10) / 10;
}

export function formatTeachingHoursLabel(hours: number): string {
  if (!(hours > 0)) return "0H";
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}H`;
  return `${String(rounded).replace(".", ",")}H`;
}

export type AcademicScheduleCalendarMeta = {
  /** Périodes de notation (PERIOD), hors examens. */
  academicPeriodCount: number;
  /** Trimestres / semestres / modules. */
  academicGroupCount: number;
  groupKind: "trimester" | "semester" | "module" | "session";
};

function isPeriodKind(kind: AcademicPeriodKind | undefined): boolean {
  return kind === "PERIOD";
}

/**
 * Calendrier scolaire du cycle (ex. primaire 6 périodes + 3 trimestres,
 * secondaire 4 périodes + 2 semestres).
 */
export function academicScheduleCalendarMeta(
  cycle: Cycle,
  educationSystem?: unknown,
): AcademicScheduleCalendarMeta {
  const structure = getAcademicStructure(cycle, educationSystem);
  const academicPeriodCount = structure.periods.filter((period) =>
    isPeriodKind(period.kind),
  ).length;
  const academicGroupCount = structure.groups.length;

  if (cycle === "SECONDAIRE" || cycle === "UNIVERSITE") {
    return {
      academicPeriodCount,
      academicGroupCount,
      groupKind: "semester",
    };
  }
  if (cycle === "CENTRE_FORMATION") {
    return {
      academicPeriodCount,
      academicGroupCount,
      groupKind: "module",
    };
  }
  if (cycle === "ATELIER") {
    return {
      academicPeriodCount,
      academicGroupCount,
      groupKind: "session",
    };
  }
  return {
    academicPeriodCount,
    academicGroupCount,
    groupKind: "trimester",
  };
}
