/**
 * Mappe un mois civil (1–12) vers l’année calendaire d’une année scolaire.
 *
 * Ex. année sept. 2026 → juil. 2027 :
 * - sept.–déc. → 2026
 * - janv.–juil. → 2027
 * - août (hors période, juste avant la rentrée) → 2026, pas 2027
 */
export function calendarYearForSchoolMonth(
  schoolYear: { startYear: string | Date; endYear: string | Date },
  month: number,
): number {
  if (month < 1 || month > 12) {
    throw new Error("Le mois doit être compris entre 1 et 12");
  }

  const start = new Date(schoolYear.startYear);
  const end = new Date(schoolYear.endYear);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const startMonth = start.getUTCMonth() + 1;
  const endMonth = end.getUTCMonth() + 1;

  if (month >= startMonth) return startYear;
  if (month <= endMonth) return endYear;
  return startYear;
}
