import { DEFAULT_CRENEAU_WORKING_DAYS } from "@/lib/creneau-working-days";
import type { GlobalScheduleCreneau } from "./types";

function sortHm(a: string, b: string) {
  return a.localeCompare(b);
}

export function unionWorkingDays(creneaux: GlobalScheduleCreneau[]) {
  const days = new Set(creneaux.flatMap((creneau) => creneau.workingDays));
  if (days.size === 0) return [...DEFAULT_CRENEAU_WORKING_DAYS];
  return DEFAULT_CRENEAU_WORKING_DAYS.filter((day) => days.has(day));
}

/** Aligne les heures du samedi sur les lignes de semaine (après-midi → matin). */
export function alignSaturdayHours(
  weekdayHours: string[],
  creneaux: GlobalScheduleCreneau[],
): { saturdayHours: string[]; saturdayEndTime: string } {
  const map = new Map<string, string>();
  let saturdayEndTime = "";
  for (const creneau of creneaux) {
    const sat = creneau.saturdaySlots ?? [];
    if (!sat.length) continue;
    let shifted = false;
    creneau.slots.forEach((slot, index) => {
      const saturday = sat[index];
      if (slot && saturday && saturday !== slot) {
        map.set(slot, saturday);
        shifted = true;
      }
    });
    if (shifted && creneau.saturdayEndTime) {
      saturdayEndTime = creneau.saturdayEndTime;
    }
  }
  if (map.size === 0) {
    return { saturdayHours: [], saturdayEndTime: "" };
  }
  return {
    saturdayHours: weekdayHours.map((hour) => map.get(hour) ?? hour),
    saturdayEndTime,
  };
}

export function teacherScheduleClock(params: {
  teacherCreneaux: GlobalScheduleCreneau[];
  fallbackHours: string[];
  allCreneaux: GlobalScheduleCreneau[];
}) {
  const source =
    params.teacherCreneaux.length > 0
      ? params.teacherCreneaux
      : params.allCreneaux;
  const hours = [
    ...new Set(
      source.length > 0
        ? source.flatMap((creneau) => creneau.slots)
        : params.fallbackHours,
    ),
  ].sort(sortHm);
  const { saturdayHours, saturdayEndTime } = alignSaturdayHours(hours, source);
  const single =
    params.teacherCreneaux.length === 1 ? params.teacherCreneaux[0] : null;

  return {
    hours,
    workingDays: unionWorkingDays(source),
    recreationHour: single?.recreationHour ?? "",
    endTime:
      single?.endTime ??
      source
        .map((creneau) => creneau.endTime)
        .filter(Boolean)
        .sort()
        .at(-1) ??
      "",
    saturdayHours,
    saturdayEndTime,
  };
}
