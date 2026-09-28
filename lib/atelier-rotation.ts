import {
  getAppWeekday,
  nowLocal,
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
  /** true seulement si ≥ 2 cours dans le cycle (sinon créneau fixe). */
  isRotating: boolean;
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

/** La rotation hebdo n’est active qu’avec au moins deux cours le même créneau. */
export function isRotationActive(itemCount: number): boolean {
  return itemCount >= 2;
}

export function parseHmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function formatMinutesToHm(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.floor(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Fin du créneau = début + durée (ex. 08:00 + 120 min → 10:00). */
export function rotationSlotEndHm(
  startHm: string,
  durationMinutes: number,
): string {
  const duration =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : 60;
  return formatMinutesToHm(parseHmToMinutes(startHm) + duration);
}

export type LiveSlotPhase = "current" | "upcoming" | "past";

/**
 * Phase live d’un créneau par rapport à `now`.
 * Après la fin (ex. 10:00), le créneau passe en `past` → le suivant remonte devant.
 */
export function getLiveSlotPhase(params: {
  slotDate: Date;
  startHm: string;
  durationMinutes: number;
  now?: Date;
}): LiveSlotPhase {
  const now = params.now ?? nowLocal();
  const dayStart = startOfTodayInTimezone(params.slotDate).getTime();
  const todayStart = startOfTodayInTimezone(now).getTime();
  if (dayStart > todayStart) return "upcoming";
  if (dayStart < todayStart) return "past";

  const startMin = parseHmToMinutes(params.startHm);
  const endMin = parseHmToMinutes(
    rotationSlotEndHm(params.startHm, params.durationMinutes),
  );
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < startMin) return "upcoming";
  if (nowMin >= endMin) return "past";
  return "current";
}

const PHASE_RANK: Record<LiveSlotPhase, number> = {
  current: 0,
  upcoming: 1,
  past: 2,
};

/** Trie pour mettre le cours en cours / suivant devant, puis les passés. */
export function compareSlotsByLivePriority(
  a: { phase: LiveSlotPhase; startHm: string; day: string },
  b: { phase: LiveSlotPhase; startHm: string; day: string },
  dayOrder: Record<string, number> = {
    Lundi: 0,
    Mardi: 1,
    Mercredi: 2,
    Jeudi: 3,
    Vendredi: 4,
    Samedi: 5,
    Dimanche: 6,
  },
): number {
  const byPhase = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
  if (byPhase !== 0) return byPhase;
  const byDay = (dayOrder[a.day] ?? 99) - (dayOrder[b.day] ?? 99);
  if (byDay !== 0) return byDay;
  return parseHmToMinutes(a.startHm) - parseHmToMinutes(b.startHm);
}

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
      isRotating: false,
      cycleLength: 0,
      weekInCycle: 0,
      weeksFromAnchor,
      coursId: null,
      nameCours: null,
      teacherId: params.defaultTeacherId ?? null,
      teacherName: params.defaultTeacherName ?? null,
    };
  }

  // Un seul cours = pas de rotation : toujours le même cours.
  if (!isRotationActive(cycleLength)) {
    const item = items[0]!;
    return {
      isClosed: Boolean(params.isClosed),
      isRotating: false,
      cycleLength: 1,
      weekInCycle: 1,
      weeksFromAnchor,
      coursId: item.coursId,
      nameCours: item.nameCours,
      teacherId: item.teacherId ?? params.defaultTeacherId ?? null,
      teacherName: item.teacherName ?? params.defaultTeacherName ?? null,
    };
  }

  const positiveMod =
    ((weeksFromAnchor % cycleLength) + cycleLength) % cycleLength;
  const item = items[positiveMod]!;
  const teacherId = item.teacherId ?? params.defaultTeacherId ?? null;
  const teacherName = item.teacherName ?? params.defaultTeacherName ?? null;

  return {
    isClosed: Boolean(params.isClosed),
    isRotating: true,
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
