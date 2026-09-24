import {
  getAppWeekday,
  startOfTodayInTimezone,
} from "@/lib/timezone";

export type RotationItemInput = {
  coursId: string;
  nameCours: string;
  sortOrder: number;
  teacherId?: string | null;
  teacherName?: string | null;
};

export type ResolvedRotation = {
  /** true si le jour civil est un jour fermé (férié) — cycle non décalé. */
  isClosed: boolean;
  cycleLength: number;
  /** 1-based index dans le cycle (1..N). */
  weekInCycle: number;
  /** Nombre de semaines calendaires depuis l'ancre (peut être négatif). */
  weeksFromAnchor: number;
  coursId: string | null;
  nameCours: string | null;
  teacherId: string | null;
  teacherName: string | null;
};

/** Lundi UTC (date-only) de la semaine contenant `date` (fuseau app). */
export function mondayOfWeekContaining(date: Date = new Date()): Date {
  const dayStart = startOfTodayInTimezone(date);
  const weekday = getAppWeekday(dayStart); // 0=Sun … 6=Sat
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return new Date(dayStart.getTime() - daysFromMonday * 86_400_000);
}

/** Différence entière de semaines calendaires entre deux lundis (UTC date). */
export function weeksBetweenMondays(anchorMonday: Date, targetMonday: Date): number {
  const a = startOfTodayInTimezone(anchorMonday).getTime();
  const b = startOfTodayInTimezone(targetMonday).getTime();
  return Math.floor((b - a) / (7 * 86_400_000));
}

/**
 * Résout le cours du cycle pour une date donnée.
 * Les jours fériés n'annulent que la séance : `isClosed=true`, index inchangé.
 */
export function resolveRotationCours(params: {
  anchorDate: Date;
  items: RotationItemInput[];
  date: Date;
  isClosed?: boolean;
  defaultTeacherId?: string | null;
  defaultTeacherName?: string | null;
}): ResolvedRotation {
  const items = [...params.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const cycleLength = items.length;
  const weeksFromAnchor = weeksBetweenMondays(
    mondayOfWeekContaining(params.anchorDate),
    mondayOfWeekContaining(params.date),
  );

  if (cycleLength === 0) {
    return {
      isClosed: Boolean(params.isClosed),
      cycleLength: 0,
      weekInCycle: 0,
      weeksFromAnchor,
      coursId: null,
      nameCours: null,
      teacherId: params.defaultTeacherId ?? null,
      teacherName: params.defaultTeacherName ?? null,
    };
  }

  const positiveMod = ((weeksFromAnchor % cycleLength) + cycleLength) % cycleLength;
  const item = items[positiveMod]!;
  const teacherId = item.teacherId ?? params.defaultTeacherId ?? null;
  const teacherName = item.teacherName ?? params.defaultTeacherName ?? null;

  return {
    isClosed: Boolean(params.isClosed),
    cycleLength,
    weekInCycle: positiveMod + 1,
    weeksFromAnchor,
    coursId: item.coursId,
    nameCours: item.nameCours,
    teacherId,
    teacherName,
  };
}

export function formatRotationCellLabel(params: {
  domainName: string;
  resolved: ResolvedRotation;
  roomName?: string | null;
}): string {
  const { domainName, resolved, roomName } = params;
  if (resolved.isClosed) {
    return `Fermé — ${domainName}`;
  }
  if (!resolved.nameCours) {
    return domainName;
  }
  const parts = [
    `${domainName} · ${resolved.nameCours}`,
    resolved.teacherName ? resolved.teacherName : null,
    roomName ? roomName : null,
  ].filter(Boolean);
  return parts.join(" — ");
}
