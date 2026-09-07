export const DEFAULT_SESSION_DURATION_MINUTES = 45;
export const MAX_WEEKLY_INTERVENTIONS = 20;

export function resolveSessionDurationMinutes(
  durationCourseMinutes?: number | null,
): number {
  return durationCourseMinutes != null && durationCourseMinutes > 0
    ? durationCourseMinutes
    : DEFAULT_SESSION_DURATION_MINUTES;
}

/** Volume hebdomadaire = durée de séance (créneau) × nombre d'interventions. */
export function weeklyMinutesFromInterventions(
  weeklyInterventions: number | null | undefined,
  durationCourseMinutes?: number | null,
): number | undefined {
  if (
    weeklyInterventions == null ||
    !Number.isFinite(weeklyInterventions) ||
    weeklyInterventions <= 0
  ) {
    return undefined;
  }
  const count = Math.min(
    MAX_WEEKLY_INTERVENTIONS,
    Math.max(1, Math.floor(weeklyInterventions)),
  );
  return resolveSessionDurationMinutes(durationCourseMinutes) * count;
}

/** Inverse : minutes stockées → nombre d'interventions (ex. 180 / 45 = 4). */
export function weeklyInterventionsFromMinutes(
  weeklyMinutes: number | null | undefined,
  durationCourseMinutes?: number | null,
): number | null {
  if (!(weeklyMinutes != null && weeklyMinutes > 0)) return null;
  const duration = resolveSessionDurationMinutes(durationCourseMinutes);
  return Math.max(1, Math.round(weeklyMinutes / duration));
}
