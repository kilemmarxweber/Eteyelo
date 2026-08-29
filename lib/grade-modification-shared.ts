/** Helpers / types sûrs côté client (pas de Prisma). */

export type GradeModificationView = {
  id: string;
  status: string;
  contextLabel: string;
  justification: string;
  evidenceUrl: string;
  previousNotes: string;
  proposedNotes: string;
  reviewComment: string | null;
  createdAt: string;
  reviewedAt: string | null;
  requesterName: string;
  ficheId: string;
};

/** Numérote les fiches d'un même type sur un cours (1, 2, 3…). */
export function numberFichesByType<
  T extends { id: string; typeFiche: string; dateCreated: Date | string },
>(fiches: T[]): Array<T & { sequence: number }> {
  const byType = new Map<string, T[]>();
  for (const fiche of fiches) {
    const list = byType.get(fiche.typeFiche) ?? [];
    list.push(fiche);
    byType.set(fiche.typeFiche, list);
  }

  const numbered = new Map<string, number>();
  for (const [, list] of byType) {
    const sorted = [...list].sort(
      (a, b) =>
        new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime(),
    );
    sorted.forEach((fiche, index) => {
      numbered.set(fiche.id, index + 1);
    });
  }

  return fiches.map((fiche) => ({
    ...fiche,
    sequence: numbered.get(fiche.id) ?? 1,
  }));
}

export function formatFicheInterventionLabel(params: {
  typeFiche: string;
  sequence: number;
  subjectName: string;
}) {
  const type =
    params.typeFiche === "ficheCote" ? "Fiche de cote" : params.typeFiche;
  const subject = params.subjectName.trim();
  const prettySubject =
    subject &&
    subject === subject.toUpperCase() &&
    /[A-ZÀ-ÿ]/.test(subject)
      ? subject
          .toLocaleLowerCase("fr-FR")
          .replace(/(^|[\s\-'])(\S)/g, (_, sep: string, ch: string) =>
            `${sep}${ch.toLocaleUpperCase("fr-FR")}`,
          )
      : subject;
  return `${type} ${params.sequence} ${prettySubject}`.trim();
}
