/**
 * Titulaire de classe avec un cours, sur l’année en cours.
 * Utilisé pour le menu / l’accès fiche centrale (pas un simple teaching).
 */
export function activeTitulaireTeachingWhere(branchId: string) {
  return {
    titulaire: true as const,
    coursId: { not: "" },
    classeId: { not: "" },
    AND: [
      { OR: [{ statusTeaching: true }, { statusTeaching: null }] },
      {
        OR: [{ branchId }, { branchId: null, classe: { branchId } }],
      },
    ],
    schoolYear: {
      branchId,
      isCurrentYear: true,
      isArchived: false,
    },
  };
}

export function areaRequiresClassTitulaire(area: string) {
  return area === "fiches" || area === "fiche_centrale";
}
