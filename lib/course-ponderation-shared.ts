/** Niveau vide = pondération commune à tous les niveaux de l'option. */
export const DEFAULT_PONDERATION_LEVEL = "";

export function normalizePonderationLevel(
  level?: string | null,
): string {
  return level?.trim() ?? DEFAULT_PONDERATION_LEVEL;
}

export function ponderationMapKey(
  coursId: string,
  optionId: string,
  level?: string | null,
): string {
  return `${coursId}:${optionId}:${normalizePonderationLevel(level)}`;
}

export function resolveCoursePonderation(
  map: Map<string, number>,
  params: {
    coursId?: string | null;
    optionId?: string | null;
    level?: string | null;
  },
) {
  if (!params.coursId || !params.optionId) return 1;
  const level = normalizePonderationLevel(params.level);
  if (level) {
    const specific = map.get(
      ponderationMapKey(params.coursId, params.optionId, level),
    );
    if (specific != null) return specific;
  }
  return (
    map.get(
      ponderationMapKey(
        params.coursId,
        params.optionId,
        DEFAULT_PONDERATION_LEVEL,
      ),
    ) ?? 1
  );
}
