import {
  drawSubjectRow,
  type DrawCellFn,
} from "@/lib/types";

/**
 * En secondaire, les colonnes hors période (EXAM, TOT, TG, SIGN PROF) de CONDUITE
 * sont noircies — pas de motif en tirets (réservé au primaire).
 */
function createSecondaryDrawCell(baseDrawCell: DrawCellFn): DrawCellFn {
  return (x, y, w, h, text, isMaxima, align, color, borders) => {
    let resolvedColor = color;
    if (
      typeof color === "object" &&
      color !== null &&
      "hatch" in color &&
      color.hatch === "dashed"
    ) {
      resolvedColor = { text: "black", fill: "black" };
    }
    baseDrawCell(x, y, w, h, text, isMaxima, align, resolvedColor, borders);
  };
}

/** Rendu des lignes générales / spéciales du bulletin secondaire (isolé du primaire). */
export function drawSecondarySubjectRow(
  drawCell: DrawCellFn,
  ...args: Parameters<typeof drawSubjectRow> extends [DrawCellFn, ...infer R] ? R : never
): number {
  return drawSubjectRow(createSecondaryDrawCell(drawCell), ...args);
}
