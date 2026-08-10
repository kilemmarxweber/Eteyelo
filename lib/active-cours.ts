/**
 * Un cours est utilisable s’il n’est pas désactivé (`statusCours !== false`).
 * `null` est traité comme actif (données historiques).
 */
export const activeCoursStatusFilter = {
  OR: [{ statusCours: true as const }, { statusCours: null }],
};

export function isCoursActive(statusCours: boolean | null | undefined): boolean {
  return statusCours !== false;
}
