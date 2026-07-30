/** Dates « Devoir du vendredi » — fuseau Africa/Kinshasa. */

const KINSHASA_OFFSET_HOURS = 1; // UTC+1 (pas de DST)

/**
 * TEMP TEST — ouvre le devoir immédiatement (ce soir).
 * Remettre à `false` après les essais pour retrouver ven. 16h → dim. 23:59.
 */
const FORCE_OPEN_NOW_FOR_TEST = false;

function toKinshasaParts(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60_000;
  const kin = new Date(utc + KINSHASA_OFFSET_HOURS * 3_600_000);
  return {
    year: kin.getUTCFullYear(),
    month: kin.getUTCMonth(),
    day: kin.getUTCDate(),
    weekday: kin.getUTCDay(), // 0=dim … 5=ven
  };
}

function kinshasaLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  ms = 0,
) {
  // Construit un instant UTC correspondant à l'heure locale Kinshasa
  return new Date(
    Date.UTC(year, month, day, hour - KINSHASA_OFFSET_HOURS, minute, second, ms),
  );
}

/** Prochain vendredi (ou aujourd'hui si vendredi), 16:00 → dimanche 23:59:59. */
export function getFridayWeekendWindow(from = new Date()) {
  // Mode test : startAt = maintenant, échéance dans ~2 jours (comme un weekend).
  if (FORCE_OPEN_NOW_FOR_TEST) {
    const startAt = new Date(from.getTime() - 60_000); // déjà ouvert
    const parts = toKinshasaParts(from);
    const dueAt = kinshasaLocalToUtc(
      parts.year,
      parts.month,
      parts.day + 2,
      23,
      59,
      59,
      999,
    );
    const activityDateOnly = new Date(
      Date.UTC(parts.year, parts.month, parts.day),
    );
    return { startAt, dueAt, activityDate: activityDateOnly };
  }

  const parts = toKinshasaParts(from);
  const daysUntilFriday = (5 - parts.weekday + 7) % 7;
  const fridayDay = parts.day + daysUntilFriday;
  const friday = kinshasaLocalToUtc(parts.year, parts.month, fridayDay, 16, 0, 0, 0);
  const sunday = kinshasaLocalToUtc(
    parts.year,
    parts.month,
    fridayDay + 2,
    23,
    59,
    59,
    999,
  );
  const activityDate = kinshasaLocalToUtc(
    parts.year,
    parts.month,
    fridayDay,
    12,
    0,
    0,
    0,
  );
  // Normalise activityDate à minuit UTC date-only friendly
  const activityDateOnly = new Date(
    Date.UTC(
      activityDate.getUTCFullYear(),
      activityDate.getUTCMonth(),
      activityDate.getUTCDate(),
    ),
  );

  return { startAt: friday, dueAt: sunday, activityDate: activityDateOnly };
}

export function toActivityDateOnly(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
