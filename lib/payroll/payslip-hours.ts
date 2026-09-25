import type { Cycle } from "@/lib/cycle";
import {
  teachingHourUnitMinutes,
  teachingHoursFromMinutes,
} from "@/lib/teacher-schedule-load";
import {
  intlLocaleFromUserLocale,
  normalizeUserLocale,
  type UserLocale,
} from "@/lib/user-locale";

/** Heures / semaine (charge) à partir des lignes GROSS du bulletin. */
export function weeklyHoursFromPayslipLines(
  lines: Array<{
    kind: string;
    cycle?: string | null;
    label?: string | null;
    detail?: unknown;
  }>,
): number | null {
  let hours = 0;
  let found = false;

  for (const line of lines) {
    if (line.kind !== "GROSS") continue;

    const detail =
      line.detail && typeof line.detail === "object"
        ? (line.detail as Record<string, unknown>)
        : null;
    if (typeof detail?.weeklyHours === "number" && detail.weeklyHours >= 0) {
      hours += detail.weeklyHours;
      found = true;
      continue;
    }

    const label = line.label ?? "";
    const minMatch = label.match(/([\d]+(?:[.,]\d+)?)\s*min\/sem/i);
    if (minMatch) {
      const mins = Number(minMatch[1].replace(",", "."));
      if (Number.isFinite(mins)) {
        const cycle = (line.cycle || "SECONDAIRE") as Cycle;
        const unit =
          typeof detail?.hourUnitMinutes === "number" &&
          detail.hourUnitMinutes > 0
            ? detail.hourUnitMinutes
            : teachingHourUnitMinutes(cycle);
        hours += teachingHoursFromMinutes(mins, unit);
        found = true;
        continue;
      }
    }

    const sessionMatch = label.match(/([\d]+(?:[.,]\d+)?)\s*séances\/sem/i);
    if (sessionMatch) {
      const sessions = Number(sessionMatch[1].replace(",", "."));
      if (Number.isFinite(sessions)) {
        hours += sessions;
        found = true;
      }
    }
  }

  if (!found) return null;
  return Math.round(hours * 10) / 10;
}

/** Affiche juste la valeur (ex. 5 ou 31.5 / 31,5), sans suffixe H. */
export function formatPayrollHoursValue(
  hours: number | null | undefined,
  locale?: UserLocale | string | null,
): string {
  if (hours == null || !(hours > 0)) return "—";
  const rounded = Math.round(hours * 10) / 10;
  const intlLocale = intlLocaleFromUserLocale(normalizeUserLocale(locale));
  return new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  }).format(rounded);
}
