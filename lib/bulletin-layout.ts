/** Marge horizontale standard des bulletins A4 (mm). */
export const BULLETIN_PAGE_MARGIN_MM = 10;

/** Largeur minimale (mm) pour afficher un maximum à 3 chiffres en police 8. */
export const MIN_EVAL_CELL_WIDTH_MM = 8.5;

/** Largeur utile du tableau bulletin sur une page A4 portrait. */
export function getBulletinFrameWidth(
  pageWidth: number,
  margin = BULLETIN_PAGE_MARGIN_MM,
): number {
  return pageWidth - 2 * margin;
}

/** Convertit des ratios relatifs en largeurs absolues (mm). */
export function scaleRatiosToWidths(
  ratios: number[],
  totalWidth: number,
): number[] {
  const sum = ratios.reduce((acc, ratio) => acc + ratio, 0);
  if (sum <= 0) {
    throw new Error("Les ratios de colonnes doivent avoir une somme positive.");
  }
  return ratios.map((ratio) => (ratio / sum) * totalWidth);
}

/** Calcule les positions X cumulées à partir des largeurs de colonnes. */
export function computeColumnPositions(
  startX: number,
  widths: number[],
): number[] {
  const positions = [startX];
  let cursor = startX;
  for (const width of widths) {
    cursor += width;
    positions.push(cursor);
  }
  return positions;
}

/** Répartit une largeur totale selon des ratios internes. */
export function splitWidthByRatios(
  totalWidth: number,
  ratios: number[],
): number[] {
  return scaleRatiosToWidths(ratios, totalWidth);
}
