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

/** Une pondération s'applique à la classe si l'option correspond, et si le niveau est commun ou identique. */
export function ponderationAppliesToClass(
  record: { optionId: string; level?: string | null },
  classe: { optionId?: string | null; level?: string | null },
): boolean {
  if (!classe.optionId || record.optionId !== classe.optionId) return false;
  const recordLevel = normalizePonderationLevel(record.level);
  if (!recordLevel) return true;
  return recordLevel === normalizePonderationLevel(classe.level);
}

export function configuredCoursIdsForClass(
  ponderations: Array<{
    coursId: string;
    optionId: string;
    level?: string | null;
  }>,
  classe: { optionId?: string | null; level?: string | null },
): string[] {
  return Array.from(
    new Set(
      ponderations
        .filter((record) => ponderationAppliesToClass(record, classe))
        .map((record) => record.coursId),
    ),
  );
}
