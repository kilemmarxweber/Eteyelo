/** Taille de police de base des rapports PDF (paramètre organisation). */
export const DEFAULT_PDF_FONT_SIZE = 10;

export const PDF_FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18] as const;

export type PdfFontSizeOption = (typeof PDF_FONT_SIZE_OPTIONS)[number];

export function parsePdfFontSize(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_PDF_FONT_SIZE;
  return Math.min(18, Math.max(8, Math.round(n)));
}

export type ReportPdfFonts = {
  /** Taille choisie dans les paramètres. */
  base: number;
  /** Corps des tableaux. */
  body: number;
  /** En-tête de tableau. */
  head: number;
  /** Titre du document. */
  title: number;
  /** Nom de l’établissement. */
  school: number;
  subtitle: number;
  meta: number;
  footer: number;
  small: number;
  /** Grilles denses (horaire). */
  dense: number;
};

/**
 * Hiérarchie de tailles à partir de la taille choisie (10, 12, 14, 16…).
 * Le nombre du paramètre = taille du corps des tableaux.
 */
export function reportPdfFonts(size?: number | null): ReportPdfFonts {
  const base = parsePdfFontSize(size);
  return {
    base,
    body: base,
    head: base,
    title: base + 4,
    school: base + 3,
    subtitle: Math.max(7, base - 1),
    meta: Math.max(6, base - 2),
    footer: Math.max(6, base - 2),
    small: Math.max(6, base - 2),
    dense: Math.max(5.5, base - 3),
  };
}

export function pdfFontsFromContext(
  context?: { pdfFontSize?: number | null } | null,
) {
  return reportPdfFonts(context?.pdfFontSize);
}
