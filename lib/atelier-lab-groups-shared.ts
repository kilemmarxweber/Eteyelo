/**
 * Libellé d'affichage du groupe atelier = nom du laboratoire (salle),
 * sinon nom du domaine pratique.
 * (Sans dépendance Prisma — utilisable côté client.)
 */
export function buildAtelierLabGroupLabel(params: {
  domainName?: string | null;
  roomName?: string | null;
  /** Conservé pour compat ; ignoré — le nom vient du labo uniquement. */
  sourceClasseName?: string | null;
  fallbackName: string;
}): string {
  const lab =
    params.roomName?.trim() ||
    params.domainName?.trim() ||
    null;
  if (lab) return lab;
  return params.fallbackName;
}
