/** Colonnes d'évaluation du bulletin primaire v2 (modèle RDC). */

export const PRIMARY_FINAL_COL_INDEX = 4;

export const PRIMARY_MAIN_COL_RATIOS = [0.17, 0.255, 0.25, 0.25, 0.075] as const;

/** Trimestre 1 : 2e MAX / PTS TRIM un peu réduits → périodes un peu plus larges */
export const PRIMARY_TRIM1_SUB_RATIOS = [0.109, 0.15, 0.15, 0.109, 0.152, 0.132, 0.198] as const;

/** Trimestres 2–3 : idem */
export const PRIMARY_TRIM23_SUB_RATIOS = [0.176, 0.176, 0.123, 0.148, 0.188, 0.189] as const;

export const PRIMARY_FINAL_SUB_RATIOS = [0.50, 0.50] as const;

export type PrimaryCellKind =
  | "max-per"
  | "period-score"
  | "max-exam"
  | "pts-exam"
  | "max-trim"
  | "pts-trim"
  | "max-total"
  | "pts-total";

export type PrimaryColumnDef = {
  key: string;
  label: string;
  kind: PrimaryCellKind;
  periodKey?: string;
  maximaKey?: string;
  trimesterIndex: 0 | 1 | 2 | 3;
};

export const PRIMARY_EVAL_COLUMNS: PrimaryColumnDef[] = [
  { key: "t1-max-per", label: "MAX", kind: "max-per", trimesterIndex: 1 },
  { key: "t1-p1", label: "1erP", kind: "period-score", periodKey: "p1", trimesterIndex: 1 },
  { key: "t1-p2", label: "2eP", kind: "period-score", periodKey: "p2", trimesterIndex: 1 },
  { key: "t1-max-ex", label: "MAX", kind: "max-exam", maximaKey: "exam1", trimesterIndex: 1 },
  { key: "t1-pts-ex", label: "PTS OBT", kind: "pts-exam", periodKey: "exam1", trimesterIndex: 1 },
  { key: "t1-max-trim", label: "MAX", kind: "max-trim", trimesterIndex: 1 },
  { key: "t1-pts-trim", label: "PTS OBT", kind: "pts-trim", trimesterIndex: 1 },

  { key: "t2-p3", label: "3eP", kind: "period-score", periodKey: "p3", trimesterIndex: 2 },
  { key: "t2-p4", label: "4eP", kind: "period-score", periodKey: "p4", trimesterIndex: 2 },
  { key: "t2-max-ex", label: "MAX", kind: "max-exam", maximaKey: "exam2", trimesterIndex: 2 },
  { key: "t2-pts-ex", label: "PTS OBT", kind: "pts-exam", periodKey: "exam2", trimesterIndex: 2 },
  { key: "t2-max-trim", label: "MAX", kind: "max-trim", trimesterIndex: 2 },
  { key: "t2-pts-trim", label: "PTS OBT", kind: "pts-trim", trimesterIndex: 2 },

  { key: "t3-p5", label: "5eP", kind: "period-score", periodKey: "p5", trimesterIndex: 3 },
  { key: "t3-p6", label: "6eP", kind: "period-score", periodKey: "p6", trimesterIndex: 3 },
  { key: "t3-max-ex", label: "MAX", kind: "max-exam", maximaKey: "exam3", trimesterIndex: 3 },
  { key: "t3-pts-ex", label: "PTS OBT", kind: "pts-exam", periodKey: "exam3", trimesterIndex: 3 },
  { key: "t3-max-trim", label: "MAX", kind: "max-trim", trimesterIndex: 3 },
  { key: "t3-pts-trim", label: "PTS OBT", kind: "pts-trim", trimesterIndex: 3 },

  { key: "final-max", label: "MAX", kind: "max-total", trimesterIndex: 0 },
  { key: "final-pts", label: "PTS OBT", kind: "pts-total", trimesterIndex: 0 },
];

export const PRIMARY_EVAL_CELL_COUNT = PRIMARY_EVAL_COLUMNS.length;

export const TRIMESTER_HEADER_LABELS: Record<1 | 2 | 3, string> = {
  1: "1er TRIMESTRE",
  2: "2e TRIMESTRE",
  3: "3e TRIMESTRE",
};

export function getTrimesterSubRatios(trimesterIndex: 1 | 2 | 3): readonly number[] {
  return trimesterIndex === 1 ? PRIMARY_TRIM1_SUB_RATIOS : PRIMARY_TRIM23_SUB_RATIOS;
}

export function getTrimesterColumnDefs(trimesterIndex: 1 | 2 | 3): PrimaryColumnDef[] {
  return PRIMARY_EVAL_COLUMNS.filter((col) => col.trimesterIndex === trimesterIndex);
}
