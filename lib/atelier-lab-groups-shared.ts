/**
 * Libellé d'affichage du groupe atelier =
 * nom du laboratoire (ou domaine) + classe source.
 * Ex. « Laboratoire sciences 1ère SC »
 * (Sans dépendance Prisma — utilisable côté client.)
 */
export function buildAtelierLabGroupLabel(params: {
  domainName?: string | null;
  roomName?: string | null;
  sourceClasseName?: string | null;
  fallbackName: string;
}): string {
  const lab =
    params.roomName?.trim() ||
    params.domainName?.trim() ||
    null;
  const source = params.sourceClasseName?.trim() || null;
  if (lab && source) return `${lab} ${source}`;
  if (lab) return lab;
  if (source) return source;
  return params.fallbackName;
}
