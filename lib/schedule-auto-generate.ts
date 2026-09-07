import type { Day } from "@/prisma/generated/prisma/client";

export const SCHEDULE_WORK_DAYS: Day[] = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export function resolveScheduleWorkDays(
  days: Day[] | string[] | null | undefined,
): Day[] {
  if (!Array.isArray(days) || days.length === 0) {
    return [...SCHEDULE_WORK_DAYS];
  }
  const allowed = new Set(SCHEDULE_WORK_DAYS);
  const unique = [
    ...new Set(days.filter((day): day is Day => allowed.has(day as Day))),
  ];
  if (!unique.length) return [...SCHEDULE_WORK_DAYS];
  return SCHEDULE_WORK_DAYS.filter((day) => unique.includes(day));
}
export function parseHmToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function formatMinutesToHm(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && bStart < aEnd;
}

/** Découpe une vacation en créneaux de cours (sans la ligne récréation). */
export function generateCourseStartSlots(params: {
  startTime: string;
  endTime: string;
  durationCourse: number;
  recreationHour?: string | null;
  recreationDuration?: number | null;
}): string[] {
  const start = parseHmToMinutes(params.startTime);
  const end = parseHmToMinutes(params.endTime);
  const interval = params.durationCourse;
  if (!(interval > 0) || !(end > start)) return [];

  const recreationStart =
    params.recreationHour && (params.recreationDuration ?? 0) > 0
      ? parseHmToMinutes(params.recreationHour)
      : null;
  const recreationDuration = params.recreationDuration ?? 0;
  const recreationEnd =
    recreationStart != null ? recreationStart + recreationDuration : null;
  const hasRecreation =
    recreationStart != null &&
    recreationEnd != null &&
    recreationDuration > 0 &&
    recreationStart > start &&
    recreationStart < end;

  const slots: number[] = [];
  let current = start;

  while (current < end) {
    if (hasRecreation && current < recreationStart!) {
      slots.push(current);
      const next = current + interval;
      current = next > recreationStart! ? recreationStart! : next;
      continue;
    }
    if (
      hasRecreation &&
      current >= recreationStart! &&
      current < recreationEnd!
    ) {
      current = recreationEnd!;
      continue;
    }
    slots.push(current);
    current += interval;
  }

  const lastStart = end - interval;
  if (
    lastStart >= start &&
    (!hasRecreation ||
      lastStart < recreationStart! ||
      lastStart >= recreationEnd!)
  ) {
    slots.push(lastStart);
  }

  return [...new Set(slots)]
    .filter((value) => value <= lastStart)
    .sort((a, b) => a - b)
    .map(formatMinutesToHm);
}

/**
 * `weeklyMinutes` = volume hebdomadaire en minutes (durée × interventions, ex. 180).
 * `durationCourseMinutes` = durée d'une période selon la vacation de la classe
 * (souvent 45 min secondaire, 30 min primaire / maternelle).
 */
export function sessionsNeededFromWeeklyMinutes(
  weeklyMinutes: number | null | undefined,
  durationCourseMinutes: number,
): number {
  if (
    !(weeklyMinutes != null && weeklyMinutes > 0) ||
    !(durationCourseMinutes > 0)
  ) {
    return 0;
  }
  return Math.max(1, Math.ceil(weeklyMinutes / durationCourseMinutes));
}

/** @deprecated utiliser sessionsNeededFromWeeklyMinutes */
export const sessionsNeededFromWeeklyHours = sessionsNeededFromWeeklyMinutes;

export type SlotKey = `${Day}|${string}`;

export function slotKey(day: Day, hourHm: string): SlotKey {
  return `${day}|${hourHm}`;
}

export type TeacherBusyInterval = {
  day: Day;
  startMin: number;
  endMin: number;
  /** Contexte pour messages (autre branche / cycle / classe). */
  label?: string;
};

export type PlacementCandidate = {
  teachingId: string;
  teacherId: string;
  courseName: string;
  /** Pondération de référence (1, 2, etc.) pour prioriser les placements. */
  ponderation?: number | null;
  sessionsNeeded: number;
  titulaire: boolean;
  weeklyMinutes: number;
  /** Périodes d'affilée (1–4). */
  consecutiveSlots?: number | null;
  /** Minutes fixées à la main : ne pas dériver le bloc de la pondération. */
  explicitWeeklyMinutes?: boolean;
  /** Jours cibles ; vide = tous les jours ouvrés. */
  preferredDays?: Day[] | null;
};

export type PlacementResult = {
  placed: Array<{ teachingId: string; day: Day; hourHm: string }>;
  failures: Array<{
    teachingId: string;
    courseName: string;
    missing: number;
    reason: string;
  }>;
};

/**
 * Blocs de N créneaux consécutifs dans la grille (ex. 07:30 + 08:15 si durée 45).
 * Deux créneaux sont consécutifs si le suivant commence exactement à fin = début + durée.
 */
export function findConsecutiveSlotBlocks(
  courseSlots: string[],
  blockSize: number,
  durationMinutes: number,
): string[][] {
  const size = Math.min(4, Math.max(1, Math.floor(blockSize) || 1));
  if (size <= 1) {
    return courseSlots.map((slot) => [slot]);
  }
  if (!(durationMinutes > 0) || courseSlots.length < size) return [];

  const mins = courseSlots.map(parseHmToMinutes);
  const blocks: string[][] = [];
  for (let i = 0; i <= courseSlots.length - size; i += 1) {
    let ok = true;
    for (let k = 1; k < size; k += 1) {
      if (mins[i + k] !== mins[i] + k * durationMinutes) {
        ok = false;
        break;
      }
    }
    if (ok) blocks.push(courseSlots.slice(i, i + size));
  }
  return blocks;
}

export function normalizeConsecutiveSlots(
  value: number | null | undefined,
): number {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(4, Math.max(1, Math.floor(value)));
}

/** Plus longue suite de périodes collées (ex. 3+3 autour de la récré → 3). */
export function maxConsecutiveRun(
  courseSlots: string[],
  durationMinutes: number,
): number {
  if (!(durationMinutes > 0) || courseSlots.length === 0) return 0;
  const mins = courseSlots.map(parseHmToMinutes);
  let best = 1;
  let run = 1;
  for (let i = 1; i < mins.length; i += 1) {
    if (mins[i] === mins[i - 1] + durationMinutes) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

function resolveCandidateBlockSize(candidate: PlacementCandidate): number {
  if (
    candidate.consecutiveSlots != null &&
    Number.isFinite(candidate.consecutiveSlots)
  ) {
    return normalizeConsecutiveSlots(candidate.consecutiveSlots);
  }
  return 1;
}

/**
 * Plafond de séances par jour quand au moins 2 jours sont attachés.
 * Ex. 3 séances + 2 h d'affilée + Lundi/Mercredi → max 2 / jour
 * (le reliquat va sur l'autre jour, pas 3 matières sur un seul).
 */
export function maxSessionsPerSpreadDay(params: {
  sessionsNeeded: number;
  attachedDayCount: number;
  consecutiveSlots?: number | null;
}): number {
  const needed = Math.max(0, params.sessionsNeeded);
  const days = Math.max(1, params.attachedDayCount);
  if (days < 2) return needed;
  const consecutive = normalizeConsecutiveSlots(params.consecutiveSlots);
  return Math.max(consecutive, Math.ceil(needed / days));
}

/** Jours les moins chargés d'abord ; égalité tirée au sort. */
export function orderDaysByLoad(
  days: Day[],
  loadForDay: (day: Day) => number,
): Day[] {
  const groups = new Map<number, Day[]>();
  for (const day of days) {
    const load = loadForDay(day);
    const bucket = groups.get(load);
    if (bucket) bucket.push(day);
    else groups.set(load, [day]);
  }
  const ordered: Day[] = [];
  for (const load of [...groups.keys()].sort((a, b) => a - b)) {
    ordered.push(...shuffledCopy(groups.get(load)!));
  }
  return ordered;
}

function sessionsFromBusyIntervals(
  intervals: TeacherBusyInterval[],
  durationMinutes: number,
): Map<Day, number> {
  const byDay = new Map<Day, number>();
  const duration = durationMinutes > 0 ? durationMinutes : 1;
  for (const slot of intervals) {
    const n = Math.max(
      1,
      Math.round((slot.endMin - slot.startMin) / duration),
    );
    byDay.set(slot.day, (byDay.get(slot.day) ?? 0) + n);
  }
  return byDay;
}

function resolveCandidateDays(
  workDays: Day[],
  preferredDays: Day[] | null | undefined,
): Day[] {
  if (!preferredDays?.length) return workDays;
  const preferred = new Set(preferredDays);
  const filtered = workDays.filter((day) => preferred.has(day));
  return filtered.length ? filtered : workDays;
}

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function shuffledCopy<T>(items: readonly T[]): T[] {
  return shuffleInPlace([...items]);
}

export function teacherIntervalConflicts(params: {
  day: Day;
  startMin: number;
  endMin: number;
  busy: TeacherBusyInterval[];
}): TeacherBusyInterval | undefined {
  return params.busy.find(
    (slot) =>
      slot.day === params.day &&
      intervalsOverlap(
        params.startMin,
        params.endMin,
        slot.startMin,
        slot.endMin,
      ),
  );
}

/**
 * Placement glouton aléatoire :
 * - évite les créneaux déjà pris par la classe ;
 * - évite tout chevauchement horaire de l'enseignant (autres classes, cycles,
 *   branches de l'organisation) via intervalles start/end ;
 * - place des blocs d'affilée (consecutiveSlots 2–4) quand demandé ;
 * - si le bloc demandé ne rentre pas (ex. 4 d'affilée sur une grille 3+3),
 *   recase en 3+1 / 2+2 / 1 pour ne pas laisser de vide ;
 * - restreint aux preferredDays s'ils sont renseignés ;
 * - si ≥ 2 jours attachés : répartit sur TOUS ces jours (pas seulement le
 *   dernier) ; 2 h d'affilée + 3 séances → 2 + 1, jamais 3 le même jour ;
 * - répartit 1 bloc / jour par passe ; jours les moins chargés d'abord.
 */
export function placeTeachingsGreedy(params: {
  candidates: PlacementCandidate[];
  courseSlots: string[];
  courseSlotsByDay?: Partial<Record<Day, string[]>>;
  durationCourseMinutes: number;
  occupiedClassSlots: Set<SlotKey>;
  /** Intervalles déjà occupés par enseignant (multi-branches / multi-cycles). */
  occupiedTeacherIntervals: Map<string, TeacherBusyInterval[]>;
  workDays?: Day[];
}): PlacementResult {
  const workDays = resolveScheduleWorkDays(params.workDays);
  const byPriority = [...params.candidates].sort((a, b) => {
    if (a.titulaire !== b.titulaire) return a.titulaire ? -1 : 1;
    if (b.weeklyMinutes !== a.weeklyMinutes) {
      return b.weeklyMinutes - a.weeklyMinutes;
    }
    return a.courseName.localeCompare(b.courseName, "fr");
  });
  const ordered: PlacementCandidate[] = [];
  let i = 0;
  while (i < byPriority.length) {
    let j = i + 1;
    while (
      j < byPriority.length &&
      byPriority[j].titulaire === byPriority[i].titulaire &&
      byPriority[j].weeklyMinutes === byPriority[i].weeklyMinutes
    ) {
      j += 1;
    }
    ordered.push(...shuffledCopy(byPriority.slice(i, j)));
    i = j;
  }

  const occupiedClass = new Set(params.occupiedClassSlots);
  const occupiedTeachers = new Map<string, TeacherBusyInterval[]>();
  const teacherDayLoad = new Map<string, Map<Day, number>>();
  for (const [teacherId, intervals] of params.occupiedTeacherIntervals) {
    occupiedTeachers.set(teacherId, intervals.map((item) => ({ ...item })));
    teacherDayLoad.set(
      teacherId,
      sessionsFromBusyIntervals(intervals, params.durationCourseMinutes),
    );
  }

  const placed: PlacementResult["placed"] = [];
  const failures: PlacementResult["failures"] = [];
  const duration = params.durationCourseMinutes;

  for (const candidate of ordered) {
    let remaining = candidate.sessionsNeeded;
    const teacherBusy =
      occupiedTeachers.get(candidate.teacherId) ?? [];
    const requestedBlock = resolveCandidateBlockSize(candidate);
    let daysPool = resolveCandidateDays(workDays, candidate.preferredDays);
    const canRelaxPreferredDays =
      Array.isArray(candidate.preferredDays) &&
      candidate.preferredDays.length > 0 &&
      daysPool.length < workDays.length;
    const teacherLoad =
      teacherDayLoad.get(candidate.teacherId) ?? new Map<Day, number>();
    const teachingDayLoad = new Map<Day, number>();

    if (!daysPool.length) {
      failures.push({
        teachingId: candidate.teachingId,
        courseName: candidate.courseName,
        missing: remaining,
        reason:
          "Aucun des jours préférés n'est ouvrable pour cette vacation.",
      });
      continue;
    }

    const slotsForDay = (day: Day) =>
      params.courseSlotsByDay?.[day] ?? params.courseSlots;

    const maxGridBlock = Math.max(
      1,
      ...daysPool.map((day) => maxConsecutiveRun(slotsForDay(day), duration)),
    );
    const blockSize = Math.min(requestedBlock, maxGridBlock);
    const spreadCap = maxSessionsPerSpreadDay({
      sessionsNeeded: candidate.sessionsNeeded,
      attachedDayCount: daysPool.length,
      consecutiveSlots: blockSize,
    });
    let enforceSpread = daysPool.length >= 2;

    const blocksForDay = (day: Day, size: number) =>
      findConsecutiveSlotBlocks(slotsForDay(day), size, duration);

    const dayLoadScore = (day: Day) =>
      (teachingDayLoad.get(day) ?? 0) * 1000 + (teacherLoad.get(day) ?? 0);

    const orderedDays = () => orderDaysByLoad(daysPool, dayLoadScore);

    const tryPlaceBlock = (day: Day, block: string[]): boolean => {
      if (
        enforceSpread &&
        (teachingDayLoad.get(day) ?? 0) + block.length > spreadCap
      ) {
        return false;
      }
      const starts = block.map(parseHmToMinutes);
      const blockStart = starts[0]!;
      const blockEnd = starts[starts.length - 1]! + duration;

      for (const hourHm of block) {
        if (occupiedClass.has(slotKey(day, hourHm))) return false;
      }
      const conflict = teacherIntervalConflicts({
        day,
        startMin: blockStart,
        endMin: blockEnd,
        busy: teacherBusy,
      });
      if (conflict) return false;

      for (const hourHm of block) {
        occupiedClass.add(slotKey(day, hourHm));
        placed.push({
          teachingId: candidate.teachingId,
          day,
          hourHm,
        });
      }
      teacherBusy.push({
        day,
        startMin: blockStart,
        endMin: blockEnd,
        label: candidate.courseName,
      });
      teachingDayLoad.set(
        day,
        (teachingDayLoad.get(day) ?? 0) + block.length,
      );
      teacherLoad.set(day, (teacherLoad.get(day) ?? 0) + block.length);
      remaining -= block.length;
      return true;
    };

    const placeOnePerDay = (chunkSize: number) => {
      let placedThisRound = 0;
      for (const day of orderedDays()) {
        if (remaining < chunkSize) break;
        const availableBlocks = blocksForDay(day, chunkSize);
        if (!availableBlocks.length) continue;
        for (const block of shuffledCopy(availableBlocks)) {
          if (tryPlaceBlock(day, block)) {
            placedThisRound += 1;
            break;
          }
        }
      }
      return placedThisRound;
    };

    while (remaining > 0) {
      let placedThisRound = 0;
      const startSize = Math.min(blockSize, remaining);
      for (let size = startSize; size >= 1; size -= 1) {
        placedThisRound = placeOnePerDay(size);
        if (placedThisRound > 0) break;
      }

      if (placedThisRound === 0) {
        if (enforceSpread) {
          enforceSpread = false;
          continue;
        }
        if (canRelaxPreferredDays && daysPool.length < workDays.length) {
          daysPool = workDays;
          enforceSpread = daysPool.length >= 2;
          continue;
        }
        break;
      }
    }

    occupiedTeachers.set(candidate.teacherId, teacherBusy);
    teacherDayLoad.set(candidate.teacherId, teacherLoad);

    if (remaining > 0) {
      failures.push({
        teachingId: candidate.teachingId,
        courseName: candidate.courseName,
        missing: remaining,
        reason:
          "Pas assez de créneaux libres : classe saturée ou enseignant déjà pris (autre classe, autre cycle ou autre établissement) sur ces plages.",
      });
    }
  }

  return { placed, failures };
}

function missingSessionsCount(failures: PlacementResult["failures"]) {
  return failures.reduce((sum, item) => sum + item.missing, 0);
}

export type PlacementAttemptResult = PlacementResult & {
  attempts: number;
  foundComplete: boolean;
};

/**
 * Si une proposition laisse des cours sans place, enchaîne automatiquement
 * d'autres tirages aléatoires jusqu'à une solution complète (ou le meilleur
 * compromis après maxAttempts).
 */
export function placeTeachingsWithRetries(
  params: {
    candidates: PlacementCandidate[];
    courseSlots: string[];
    courseSlotsByDay?: Partial<Record<Day, string[]>>;
    durationCourseMinutes: number;
    occupiedClassSlots: Set<SlotKey>;
    occupiedTeacherIntervals: Map<string, TeacherBusyInterval[]>;
    workDays?: Day[];
  },
  options?: { maxAttempts?: number },
): PlacementAttemptResult {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 48);
  let best: PlacementResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = placeTeachingsGreedy(params);
    if (result.failures.length === 0) {
      return {
        ...result,
        attempts: attempt,
        foundComplete: true,
      };
    }

    if (!best) {
      best = result;
      continue;
    }

    const bestMissing = missingSessionsCount(best.failures);
    const nextMissing = missingSessionsCount(result.failures);
    if (
      nextMissing < bestMissing ||
      (nextMissing === bestMissing && result.placed.length > best.placed.length)
    ) {
      best = result;
    }
  }

  return {
    ...(best ?? { placed: [], failures: [] }),
    attempts: maxAttempts,
    foundComplete: false,
  };
}
