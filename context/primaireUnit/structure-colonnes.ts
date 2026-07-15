/**
 * Source de vérité — structure des colonnes du bulletin primaire (modèle RDC).
 *
 * Ce fichier vit dans `context/primaireUnit/` comme spécification.
 * Lors de l'exécution du plan, ces constantes seront portées vers
 * `bulletin-primary-layout.ts` (ou importées depuis un module lib dédié).
 */

/** Index de la colonne finale MAX | PTS OBT (remplace TG). */
export const PRIMARY_FINAL_COL_INDEX = 4;

/** 5 colonnes : BRANCHES | TRIM1 | TRIM2 | TRIM3 | MAX | PTS OBT */
export const PRIMARY_MAIN_COL_RATIOS = [0.07, 0.29, 0.27, 0.27, 0.10] as const;

export const PRIMARY_TRIM1_SUB_RATIOS = [
  1 / 7, 1 / 7, 1 / 7, 1 / 7, 1 / 7, 1 / 7, 1 / 7,
] as const;

export const PRIMARY_TRIM23_SUB_RATIOS = [
  1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6,
] as const;

/** Colonne finale : MAX | PTS OBT (pas de titre parent TOTAL/TG) */
export const PRIMARY_FINAL_SUB_RATIOS = [0.50, 0.50] as const;

/** Types de cellules dans la grille */
export type PrimaryCellKind =
  | "max-per"       // Maxima période (trim 1 seulement, colonne dédiée)
  | "period-score"  // Note période (1erP … 6eP)
  | "max-exam"      // Maxima examen
  | "pts-exam"      // Points obtenus examen
  | "max-trim"      // Maxima trimestre
  | "pts-trim"      // Points obtenus trimestre
  | "max-total"     // Maxima annuel
  | "pts-total";    // Points obtenus annuel

export type PrimaryColumnDef = {
  key: string;
  label: string;
  kind: PrimaryCellKind;
  periodKey?: string;
  maximaKey?: string;
  trimesterIndex: 1 | 2 | 3 | 0; // 0 = colonne finale MAX | PTS OBT
};

/** Définition ordonnée des 21 cellules d'évaluation (hors BRANCHES). */
export const PRIMARY_EVAL_COLUMNS: PrimaryColumnDef[] = [
  // ── 1er trimestre (7) ──
  { key: "t1-max-per", label: "MAX Per", kind: "max-per", trimesterIndex: 1 },
  { key: "t1-p1", label: "1erP", kind: "period-score", periodKey: "p1", trimesterIndex: 1 },
  { key: "t1-p2", label: "2eP", kind: "period-score", periodKey: "p2", trimesterIndex: 1 },
  { key: "t1-max-ex", label: "MAX EX", kind: "max-exam", maximaKey: "exam1", trimesterIndex: 1 },
  { key: "t1-pts-ex", label: "PTS OBT", kind: "pts-exam", periodKey: "exam1", trimesterIndex: 1 },
  { key: "t1-max-trim", label: "MAX TRIM", kind: "max-trim", trimesterIndex: 1 },
  { key: "t1-pts-trim", label: "PTS OBT", kind: "pts-trim", trimesterIndex: 1 },

  // ── 2e trimestre (6) ──
  { key: "t2-p3", label: "3eP", kind: "period-score", periodKey: "p3", trimesterIndex: 2 },
  { key: "t2-p4", label: "4eP", kind: "period-score", periodKey: "p4", trimesterIndex: 2 },
  { key: "t2-max-ex", label: "MAX EX", kind: "max-exam", maximaKey: "exam2", trimesterIndex: 2 },
  { key: "t2-pts-ex", label: "PTS OBT", kind: "pts-exam", periodKey: "exam2", trimesterIndex: 2 },
  { key: "t2-max-trim", label: "MAX TRIM", kind: "max-trim", trimesterIndex: 2 },
  { key: "t2-pts-trim", label: "PTS OBT", kind: "pts-trim", trimesterIndex: 2 },

  // ── 3e trimestre (6) ──
  { key: "t3-p5", label: "5eP", kind: "period-score", periodKey: "p5", trimesterIndex: 3 },
  { key: "t3-p6", label: "6eP", kind: "period-score", periodKey: "p6", trimesterIndex: 3 },
  { key: "t3-max-ex", label: "MAX EX", kind: "max-exam", maximaKey: "exam3", trimesterIndex: 3 },
  { key: "t3-pts-ex", label: "PTS OBT", kind: "pts-exam", periodKey: "exam3", trimesterIndex: 3 },
  { key: "t3-max-trim", label: "MAX TRIM", kind: "max-trim", trimesterIndex: 3 },
  { key: "t3-pts-trim", label: "PTS OBT", kind: "pts-trim", trimesterIndex: 3 },

  // ── Colonne finale annuelle (2) ──
  { key: "final-max", label: "MAX", kind: "max-total", trimesterIndex: 0 },
  { key: "final-pts", label: "PTS OBT", kind: "pts-total", trimesterIndex: 0 },
];

/**
 * Libellés en-tête niveau 1 par colonne principale.
 * Colonne 4 : pas de titre parent — seuls MAX | PTS OBT apparaissent au niveau 2.
 */
export const PRIMARY_MAIN_HEADERS = [
  "BRANCHES",
  "1er TRIMESTRE",
  "2e TRIMESTRE",
  "3e TRIMESTRE",
  "",
] as const;

/** Nombre total de cellules d'évaluation (hors colonne BRANCHES). */
export const PRIMARY_EVAL_CELL_COUNT = PRIMARY_EVAL_COLUMNS.length; // 21

/** Mapping trimestre → clés de stockage sem1/sem2/sem3 */
export const TRIMESTER_STORAGE_KEYS = {
  1: "sem1",
  2: "sem2",
  3: "sem3",
} as const;

/** Périodes actives par trimestre */
export const TRIMESTER_PERIOD_KEYS = {
  1: ["p1", "p2", "exam1"] as const,
  2: ["p3", "p4", "exam2"] as const,
  3: ["p5", "p6", "exam3"] as const,
} as const;

/**
 * Retourne les ratios de sous-colonnes pour un trimestre donné.
 */
export function getTrimesterSubRatios(trimesterIndex: 1 | 2 | 3): readonly number[] {
  return trimesterIndex === 1 ? PRIMARY_TRIM1_SUB_RATIOS : PRIMARY_TRIM23_SUB_RATIOS;
}

/**
 * Nombre de sous-colonnes par trimestre.
 */
export function getTrimesterSubColumnCount(trimesterIndex: 1 | 2 | 3): number {
  return trimesterIndex === 1 ? 7 : 6;
}
