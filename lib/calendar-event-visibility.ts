import type { Recurrence } from "@/prisma/generated/prisma/client";
import { dayRangeInAppTimezone, nowLocal } from "@/lib/timezone";

export type CalendarEventVisibilityInput = {
  dateStart: Date;
  dateEnd?: Date | null;
  recurrence?: Recurrence | string | null;
  allDay?: boolean | null;
};

function addCalendarMonths(date: Date, months: number): Date {
  const day = dayRangeInAppTimezone(date);
  const [year, month, dayOfMonth] = day.dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, dayOfMonth));
  // Clamp if overflow (ex. 31 jan + 1 mois).
  if (target.getUTCDate() !== dayOfMonth) {
    target.setUTCDate(0);
  }
  return dayRangeInAppTimezone(target).end;
}

function addCalendarDays(date: Date, days: number): Date {
  const day = dayRangeInAppTimezone(date);
  return new Date(day.start.getTime() + days * 86_400_000);
}

/**
 * Fin de visibilité publique d’un événement, selon `dateEnd` puis `recurrence`.
 * - `dateEnd` explicite : fin de ce jour civil (ou l’heure exacte si non all-day).
 * - sinon : durée dérivée de la récurrence depuis `dateStart`.
 */
export function getCalendarEventVisibilityEnd(
  event: CalendarEventVisibilityInput,
): Date {
  if (event.dateEnd) {
    if (event.allDay === false) return new Date(event.dateEnd);
    return dayRangeInAppTimezone(event.dateEnd).end;
  }

  const start = event.dateStart;
  const recurrence = (event.recurrence ?? "JOURNALIER").toString().toUpperCase();

  switch (recurrence) {
    case "HEBDOMADAIRE":
      return addCalendarDays(start, 7);
    case "MENSUEL":
      return addCalendarMonths(start, 1);
    case "TRIMESTRIEL":
      return addCalendarMonths(start, 3);
    case "SEMESTRIEL":
      return addCalendarMonths(start, 6);
    case "ANNUEL":
      return addCalendarMonths(start, 12);
    case "JOURNALIER":
    default:
      // Journalier : disparaît dès que le jour de l’événement est passé.
      return dayRangeInAppTimezone(start).end;
  }
}

/** True tant que l’événement doit rester visible sur les pages publiques. */
export function isCalendarEventPubliclyVisible(
  event: CalendarEventVisibilityInput,
  now: Date = nowLocal(),
): boolean {
  return now.getTime() < getCalendarEventVisibilityEnd(event).getTime();
}

/** Filtre + tri chronologique (début croissant) pour l’affichage public. */
export function filterPublicCalendarEvents<T extends CalendarEventVisibilityInput>(
  events: T[],
  now: Date = nowLocal(),
): T[] {
  return events
    .filter((event) => isCalendarEventPubliclyVisible(event, now))
    .sort((left, right) => left.dateStart.getTime() - right.dateStart.getTime());
}
