/**
 * Frais non obligatoire (ex. uniforme).
 *
 * Tant qu'aucun paiement n'a été alloué à ce frais pour l'inscription,
 * il n'entre pas au compte de l'élève. Dès qu'il est accepté (coché au
 * paiement et payé, même partiellement), il devient dû — priorité 0.
 */
export function isFraisChargedOnAccount(
  isOptional: boolean,
  alreadyPaid: number,
): boolean {
  if (!isOptional) return true;
  return alreadyPaid > 0;
}

/** Un frais optionnel accepté est toujours prioritaire (0). */
export function resolveFraisPriority(
  isOptional: boolean,
  priority?: number | null,
): number {
  if (isOptional) return 0;
  return priority ?? 99;
}
