import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import { roundCurrency } from "@/lib/exchange-rate";

/** Samedi et dimanche sont hors volume de paie (primaire et secondaire). */
export const PAYROLL_WEEKEND_DAYS = new Set(["Samedi", "Dimanche"]);

const UTC_TO_DAY: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
};

export type WeeklyPrimaryVolume = {
  minutes: number;
  sessions: number;
  minutesByDay: Record<string, number>;
  sessionsByDay: Record<string, number>;
};

export function isPayrollWeekendDate(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function isPayrollWeekendDay(day: string): boolean {
  return PAYROLL_WEEKEND_DAYS.has(day);
}

/** Minutes de retard réelles (avant franchise), à partir du pointage. */
export function rawLateMinutes(checkIn: Date | null | undefined, start: Date): number {
  if (!checkIn) return 0;
  return Math.max(0, (checkIn.getTime() - start.getTime()) / 60000);
}

/** Minutes facturées : au-delà de la franchise (5 min par défaut). */
export function billableLateMinutes(rawLate: number, graceMinutes: number): number {
  if (rawLate <= 0) return 0;
  return Math.max(0, rawLate - Math.max(0, graceMinutes));
}

export function emptyWeeklyVolume(): WeeklyPrimaryVolume {
  return { minutes: 0, sessions: 0, minutesByDay: {}, sessionsByDay: {} };
}

/**
 * Volume hebdomadaire issu de l'horaire : chaque créneau compte une séance,
 * samedi et dimanche exclus.
 */
export function weeklyVolumeFromScheduleSlots(
  slots: Array<{ day: string; durationMinutes: number }>,
): WeeklyPrimaryVolume {
  const minutesByDay: Record<string, number> = {};
  const sessionsByDay: Record<string, number> = {};
  let minutes = 0;
  let sessions = 0;
  for (const slot of slots) {
    if (isPayrollWeekendDay(slot.day)) continue;
    const duration = Math.max(0, slot.durationMinutes);
    if (duration <= 0) continue;
    minutesByDay[slot.day] = (minutesByDay[slot.day] ?? 0) + duration;
    sessionsByDay[slot.day] = (sessionsByDay[slot.day] ?? 0) + 1;
    minutes += duration;
    sessions += 1;
  }
  return { minutes, sessions, minutesByDay, sessionsByDay };
}

/** Jours Lundi–Vendredi du mois (dates UTC, alignées sur la paie). */
export function weekdayDatesInMonth(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (isPayrollWeekendDate(date)) continue;
    dates.push(date);
  }
  return dates;
}

export function weekdayCountInMonth(year: number, month: number): number {
  return weekdayDatesInMonth(year, month).length;
}

export function weekdayOccurrencesInMonth(
  year: number,
  month: number,
): Record<string, number> {
  const counts: Record<string, number> = {
    Lundi: 0,
    Mardi: 0,
    Mercredi: 0,
    Jeudi: 0,
    Vendredi: 0,
  };
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= days; day += 1) {
    const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const name = UTC_TO_DAY[utcDay];
    if (!name) continue;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

/**
 * Minutes dues dans le mois = pattern hebdo × occurrences Lundi–Vendredi.
 * Ex. 240 min/jour × 22 jours ouvrés = 5 280 min.
 */
export function monthlyMinutesFromWeeklyVolume(
  weekly: WeeklyPrimaryVolume,
  year: number,
  month: number,
): number {
  const occurrences = weekdayOccurrencesInMonth(year, month);
  let total = 0;
  for (const [day, minutes] of Object.entries(weekly.minutesByDay)) {
    total += minutes * (occurrences[day] ?? 0);
  }
  return total;
}

export function primaryUnitRates(
  forfait: number,
  monthlyMinutes: number,
  sessionMinutes: number,
  currency: CurrencyCode,
) {
  const ratePerMinute = monthlyMinutes > 0 && forfait > 0 ? forfait / monthlyMinutes : 0;
  return {
    ratePerMinute,
    ratePerSession: roundCurrency(ratePerMinute * Math.max(0, sessionMinutes), currency),
  };
}

/** Durée contractuelle d’une séance (créneau), pas l’écart horloge. */
export function contractualSessionMinutes(
  creneauDuration: number | null | undefined,
  policyMinutes: number,
  fallback: number,
) {
  if (creneauDuration != null && creneauDuration > 0) return creneauDuration;
  return policyMinutes > 0 ? policyMinutes : fallback;
}

export function secondaryNonMatriculeRates(
  sessionRate: number,
  sessionMinutes: number,
  currency: CurrencyCode,
) {
  const ratePerMinute =
    sessionMinutes > 0 && sessionRate > 0 ? sessionRate / sessionMinutes : 0;
  return {
    ratePerMinute,
    ratePerSession: roundCurrency(Math.max(0, sessionRate), currency),
  };
}

/** Montant de séance du barème (non matriculé), repli sur le taux horaire. */
export function payrollSessionAmount(policy: {
  secondaryNonMatriculeSessionRate?: number | null;
  secondaryHourlyRate?: number | null;
}) {
  const session = Number(policy.secondaryNonMatriculeSessionRate ?? 0);
  if (session > 0) return session;
  return Math.max(0, Number(policy.secondaryHourlyRate ?? 0));
}

/**
 * Matriculé : 30 % (barème) du montant de séance, pas un prorata horaire.
 * Ex. 30 % × 1 500 = 450 / séance de 45 min → 10 / min.
 */
export function secondaryMatriculeRates(
  sessionAmount: number,
  primePercent: number,
  sessionMinutes: number,
  currency: CurrencyCode,
) {
  const sessionGross = Math.max(0, sessionAmount) * Math.max(0, primePercent) / 100;
  const ratePerMinute =
    sessionMinutes > 0 && sessionGross > 0 ? sessionGross / sessionMinutes : 0;
  return {
    ratePerMinute,
    ratePerSession: roundCurrency(sessionGross, currency),
  };
}

export function monthlySessionsFromWeeklyVolume(
  weekly: WeeklyPrimaryVolume,
  year: number,
  month: number,
): number {
  const occurrences = weekdayOccurrencesInMonth(year, month);
  let total = 0;
  for (const [day, sessions] of Object.entries(weekly.sessionsByDay)) {
    total += sessions * (occurrences[day] ?? 0);
  }
  return total;
}

export function sessionGrossFromRate(
  ratePerMinute: number,
  durationMinutes: number,
  currency: CurrencyCode,
): number {
  if (ratePerMinute <= 0 || durationMinutes <= 0) return 0;
  return roundCurrency(ratePerMinute * durationMinutes, currency);
}

/** Personnel : brut+prime ÷ jours ouvrés, puis ÷ minutes de la journée. */
export function personnelUnitRates(
  total: number,
  weekdayCount: number,
  dayMinutes: number,
  currency: CurrencyCode,
) {
  const ratePerDay = weekdayCount > 0 && total > 0 ? total / weekdayCount : 0;
  const ratePerMinute =
    dayMinutes > 0 && ratePerDay > 0 ? ratePerDay / dayMinutes : 0;
  return {
    ratePerDay: roundCurrency(ratePerDay, currency),
    ratePerMinute,
  };
}
