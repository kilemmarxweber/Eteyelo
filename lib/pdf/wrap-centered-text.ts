import type { jsPDF } from "jspdf";

/** Dessine un texte centré, renvoyé à la ligne s'il est trop long. */
export function drawCenteredWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 4.6,
): number {
  const lines = doc.splitTextToSize(text || "", maxWidth) as string[];
  doc.text(lines, x, y, { align: "center" });
  return y + Math.max(lines.length, 1) * lineHeight;
}
