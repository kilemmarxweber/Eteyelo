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
 * `weeklyMinutes` = volume hebdomadaire en minutes (ex. 135).
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
  sessionsNeeded: number;
  titulaire: boolean;
  weeklyMinutes: number;
  /** Périodes d'affilée (1–4). */
  consecutiveSlots?: number | null;
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

function resolveCandidateDays(
  workDays: Day[],
  preferredDays: Day[] | null | undefined,
): Day[] {
  if (!preferredDays?.length) return workDays;
  const preferred = new Set(preferredDays);
  const filtered = workDays.filter((day) => preferred.has(day));
  return filtered;
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
 * - restreint aux preferredDays s'ils sont renseignés ;
 * - répartit 1 bloc / jour par passe ; ordre aléatoire à chaque appel.
 */
export function placeTeachingsGreedy(params: {
  candidates: PlacementCandidate[];
  courseSlots: string[];
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
    return 0;
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
  for (const [teacherId, intervals] of params.occupiedTeacherIntervals) {
    occupiedTeachers.set(teacherId, intervals.map((item) => ({ ...item })));
  }

  const placed: PlacementResult["placed"] = [];
  const failures: PlacementResult["failures"] = [];
  const duration = params.durationCourseMinutes;

  for (const candidate of ordered) {
    let remaining = candidate.sessionsNeeded;
    const teacherBusy =
      occupiedTeachers.get(candidate.teacherId) ?? [];
    const blockSize = normalizeConsecutiveSlots(candidate.consecutiveSlots);
    const daysPool = resolveCandidateDays(workDays, candidate.preferredDays);

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

    const blocks = findConsecutiveSlotBlocks(
      params.courseSlots,
      blockSize,
      duration,
    );

    if (blockSize > 1 && !blocks.length) {
      failures.push({
        teachingId: candidate.teachingId,
        courseName: candidate.courseName,
        missing: remaining,
        reason: `Impossible de former ${blockSize} périodes d'affilée sur cette vacation (grille / récréation).`,
      });
      continue;
    }

    const tryPlaceBlock = (day: Day, block: string[]): boolean => {
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
      remaining -= block.length;
      return true;
    };

    while (remaining > 0) {
      let placedThisRound = 0;
      const days = shuffledCopy(daysPool);

      if (blockSize > 1 && remaining >= blockSize) {
        for (const day of days) {
          if (remaining < blockSize) break;
          for (const block of shuffledCopy(blocks)) {
            if (tryPlaceBlock(day, block)) {
              placedThisRound += 1;
              break;
            }
          }
        }
      } else {
        const singleBlocks =
          blockSize === 1
            ? blocks
            : findConsecutiveSlotBlocks(params.courseSlots, 1, duration);
        for (const day of days) {
          if (remaining <= 0) break;
          for (const block of shuffledCopy(singleBlocks)) {
            if (tryPlaceBlock(day, block)) {
              placedThisRound += 1;
              break;
            }
          }
        }
      }

      if (placedThisRound === 0) {
        // Reste < taille de bloc : tenter des séances isolées pour finir.
        if (blockSize > 1 && remaining > 0 && remaining < blockSize) {
          let placedRemainder = 0;
          const singles = findConsecutiveSlotBlocks(
            params.courseSlots,
            1,
            duration,
          );
          for (const day of shuffledCopy(daysPool)) {
            if (remaining <= 0) break;
            for (const block of shuffledCopy(singles)) {
              if (tryPlaceBlock(day, block)) {
                placedRemainder += 1;
                break;
              }
            }
          }
          if (placedRemainder === 0) break;
          continue;
        }
        break;
      }
    }

    occupiedTeachers.set(candidate.teacherId, teacherBusy);

    if (remaining > 0) {
      failures.push({
        teachingId: candidate.teachingId,
        courseName: candidate.courseName,
        missing: remaining,
        reason:
          blockSize > 1
            ? `Pas assez de plages pour ${blockSize} périodes d'affilée (classe saturée, jours préférés, ou enseignant déjà pris).`
            : "Pas assez de créneaux libres : classe saturée ou enseignant déjà pris (autre classe, autre cycle ou autre établissement) sur ces plages.",
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
