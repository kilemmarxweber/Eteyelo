import type jsPDF from "jspdf";

/** Marges latérales réduites pour remplir la page paysage A4. */
export const SCHEDULE_PDF_MARGIN_X_MM = 6;
export const SCHEDULE_PDF_MARGIN_BOTTOM_MM = 12;

/**
 * Répartit la largeur utile en paysage : colonne heures fixe + jours égaux.
 */
export function schedulePdfTableLayout(doc: jsPDF, dayCount: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const usable = pageWidth - SCHEDULE_PDF_MARGIN_X_MM * 2;
  const hoursCol = Math.min(28, Math.max(22, usable * 0.11));
  const days = Math.max(dayCount, 1);
  const dayWidth = (usable - hoursCol) / days;

  const columnStyles: Record<
    number,
    { cellWidth: number; fontStyle?: "bold" | "normal" | "italic" }
  > = {
    0: { cellWidth: hoursCol, fontStyle: "bold" },
  };
  for (let i = 0; i < days; i++) {
    columnStyles[i + 1] = { cellWidth: dayWidth };
  }

  return {
    marginX: SCHEDULE_PDF_MARGIN_X_MM,
    tableWidth: usable,
    columnStyles,
  };
}
