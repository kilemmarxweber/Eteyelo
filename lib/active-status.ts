/**
 * Filtres « actif » pour les compteurs (dashboard, listings).
 * Aligné sur le personnel : `isActive` + `branchMember.isActive`.
 * `null` = actif pour les statuts historiques (classes, comme les cours).
 */

export const activeClasseStatusFilter = {
  OR: [{ statusClasse: true as const }, { statusClasse: null }],
};

export function isClasseActive(
  statusClasse: boolean | null | undefined,
): boolean {
  return statusClasse !== false;
}

export function activeClasseWhere(classScope: object = {}) {
  return { AND: [classScope, activeClasseStatusFilter] };
}

export function activeStudentFilter(branchId: string) {
  return {
    OR: [
      { branchMember: { isActive: true as const } },
      {
        branchLinks: {
          some: { targetBranchId: branchId, isActive: true as const },
        },
      },
    ],
  };
}

export const activeTeacherProfileFilter = {
  isActive: true as const,
  branchMember: { isActive: true as const },
};

export const activePersonnelProfileFilter = {
  isActive: true as const,
  branchMember: { isActive: true as const },
};
