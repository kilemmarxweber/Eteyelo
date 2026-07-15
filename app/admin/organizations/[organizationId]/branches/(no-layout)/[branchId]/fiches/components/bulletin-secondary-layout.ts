import type { jsPDF } from "jspdf";

import {
  BULLETIN_INNER_LINE_WIDTH_MM,
  BULLETIN_PAGE_MARGIN_MM,
  MIN_EVAL_CELL_WIDTH_MM,
  computeColumnPositions,
  getBulletinFrameWidth,
} from "@/lib/bulletin-layout";

/** Multiplie chaque ratio par la largeur totale, sans normalisation (comme ef2d740). */
function scaleRatiosDirect(ratios: number[], totalWidth: number): number[] {
  return ratios.map((ratio) => ratio * totalWidth);
}

/**
 * Colonnes principales : BRANCHES | SEM1 | SEM2 | TG | SIGN PROF | SPACER | REPECHAGE
 * Proportions identiques au commit ef2d740 (feat: bulletin ponderation dynamic).
 */
export const SECONDARY_MAIN_COL_RATIOS = [
  0.2, 0.22, 0.22, 0.07, 0.09, 0.02, 0.08,
];

/** Sous-colonnes d'un semestre : TR JOURN (périodes) | EXAM | TOT */
export const SECONDARY_SEM_SUB_RATIOS = [0.5, 0.25, 0.25];

/** Largeur fixe du spacer noir entre SIGN PROF et repechage (mm). */
export const SECONDARY_SPACER_WIDTH_MM = 4;

/** Largeur fixe de la colonne repechage (mm). */
export const SECONDARY_REPECHAGE_WIDTH_MM = 34.1;

/** Répartition des deux périodes dans TR JOURN */
export const SECONDARY_PERIOD_RATIOS = [0.5, 0.5];

/** Part gauche de la colonne repechage (%), anciennement 13 / 34.1 */
export const SECONDARY_REPECHAGE_PERCENT_RATIO = 13 / 34.1;

export type SecondaryBulletinLayout = {
  frameWidth: number;
  tableX: number;
  shiftX: number;
  tableY: number;
  shiftY: number;
  rowHeightTotal: number;
  hTop: number;
  hMid: number;
  hBottom: number;
  colWidths: number[];
  colPos: number[];
  sem1SubWidths: number[];
  sem2SubWidths: number[];
  sem1PeriodWidths: number[];
  sem2PeriodWidths: number[];
  totX1: number;
  examX1: number;
  totX2: number;
  examX2: number;
  repechageWidth: number;
  repechagePercentWidth: number;
  repechageSignatureWidth: number;
  spacerWidth: number;
};

export type BuildSecondaryLayoutParams = {
  pageWidth: number;
  margin?: number;
  tableX?: number;
  tableY?: number;
  shiftX?: number;
  shiftY?: number;
  rowHeightTotal?: number;
  hTop?: number;
  hMid?: number;
  hBottom?: number;
};

export function buildSecondaryBulletinLayout(
  params: BuildSecondaryLayoutParams,
): SecondaryBulletinLayout {
  const margin = params.margin ?? BULLETIN_PAGE_MARGIN_MM;
  const frameWidth = getBulletinFrameWidth(params.pageWidth, margin);
  const tableX = params.tableX ?? margin;
  const shiftX = params.shiftX ?? 0;

  const colWidths = scaleRatiosDirect(SECONDARY_MAIN_COL_RATIOS, frameWidth);
  const colPos = computeColumnPositions(tableX, colWidths);

  const sem1SubWidths = scaleRatiosDirect(
    SECONDARY_SEM_SUB_RATIOS,
    colWidths[1],
  );
  const sem2SubWidths = scaleRatiosDirect(
    SECONDARY_SEM_SUB_RATIOS,
    colWidths[2],
  );
  const sem1PeriodWidths = scaleRatiosDirect(
    SECONDARY_PERIOD_RATIOS,
    sem1SubWidths[0],
  );
  const sem2PeriodWidths = scaleRatiosDirect(
    SECONDARY_PERIOD_RATIOS,
    sem2SubWidths[0],
  );

  const totX1 = colPos[1] + shiftX + sem1SubWidths[0];
  const examX1 = totX1 + sem1SubWidths[1];
  const totX2 = colPos[2] + shiftX + sem2SubWidths[0];
  const examX2 = totX2 + sem2SubWidths[1];

  const repechageWidth = SECONDARY_REPECHAGE_WIDTH_MM;
  const repechagePercentWidth = repechageWidth * SECONDARY_REPECHAGE_PERCENT_RATIO;
  const repechageSignatureWidth = repechageWidth - repechagePercentWidth;
  const spacerWidth = SECONDARY_SPACER_WIDTH_MM;

  return {
    frameWidth,
    tableX,
    shiftX,
    tableY: params.tableY ?? 0,
    shiftY: params.shiftY ?? 0,
    rowHeightTotal: params.rowHeightTotal ?? 20,
    hTop: params.hTop ?? 7,
    hMid: params.hMid ?? 7,
    hBottom: params.hBottom ?? 7,
    colWidths,
    colPos,
    sem1SubWidths,
    sem2SubWidths,
    sem1PeriodWidths,
    sem2PeriodWidths,
    totX1,
    examX1,
    totX2,
    examX2,
    repechageWidth,
    repechagePercentWidth,
    repechageSignatureWidth,
    spacerWidth,
  };
}

/** Retourne les six largeurs des cases d'évaluation (P1, P2, EXAM1, P3, P4, EXAM2). */
export function getSecondaryEvaluationCellWidths(
  layout: SecondaryBulletinLayout,
): number[] {
  return [
    layout.sem1PeriodWidths[0],
    layout.sem1PeriodWidths[1],
    layout.sem1SubWidths[1],
    layout.sem2PeriodWidths[0],
    layout.sem2PeriodWidths[1],
    layout.sem2SubWidths[1],
  ];
}

export function getSecondarySemesterDrawConfig(
  layout: SecondaryBulletinLayout,
  maximaHeight: number,
) {
  return {
    colPos: layout.colPos,
    shiftX: layout.shiftX,
    sem1PeriodWidths: layout.sem1PeriodWidths,
    sem2PeriodWidths: layout.sem2PeriodWidths,
    sem1SubWidths: layout.sem1SubWidths,
    sem2SubWidths: layout.sem2SubWidths,
    totX1: layout.totX1,
    totX2: layout.totX2,
    examX1: layout.examX1,
    examX2: layout.examX2,
    maximaHeight,
  };
}

export function drawSecondaryTableHeader(
  doc: jsPDF,
  layout: SecondaryBulletinLayout,
): void {
  const {
    tableX,
    shiftX,
    tableY,
    shiftY,
    rowHeightTotal,
    hTop,
    hMid,
    hBottom,
    colWidths,
    colPos,
    sem1SubWidths,
    sem2SubWidths,
    sem1PeriodWidths,
    sem2PeriodWidths,
    repechageWidth,
    repechagePercentWidth,
    repechageSignatureWidth,
    spacerWidth,
  } = layout;

  doc.saveGraphicsState();
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(BULLETIN_INNER_LINE_WIDTH_MM);

  doc.rect(tableX + shiftX, tableY + shiftY, layout.frameWidth, rowHeightTotal);

  doc.rect(
    colPos[0] + shiftX,
    tableY + shiftY,
    colWidths[0],
    rowHeightTotal,
  );
  doc.setFontSize(8);
  doc.text(
    "BRANCHES",
    colPos[0] + shiftX + colWidths[0] / 2,
    tableY + shiftY + rowHeightTotal / 2,
    { align: "center", baseline: "middle" },
  );

  const xPS = colPos[1];
  doc.rect(xPS + shiftX, tableY + shiftY, colWidths[1], hTop);
  doc.text(
    "PREMIER SEMESTRE",
    xPS + shiftX + colWidths[1] / 2,
    tableY + shiftY + hTop / 2,
    { align: "center", baseline: "middle" },
  );

  let subX = xPS + shiftX;
  doc.rect(subX, tableY + hTop + shiftY, sem1SubWidths[0], hMid + hBottom);
  doc.text(
    "TR JOURN",
    subX + sem1SubWidths[0] / 2,
    tableY + hTop + shiftY + hMid / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX + sem1SubWidths[0],
    tableY + hTop + shiftY,
    sem1SubWidths[1],
    hMid + hBottom,
  );
  doc.text(
    "EXAM",
    subX + sem1SubWidths[0] + sem1SubWidths[1] / 2,
    tableY + hTop + shiftY + (hMid + hBottom) / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX + sem1SubWidths[0] + sem1SubWidths[1],
    tableY + hTop + shiftY,
    sem1SubWidths[2],
    hMid + hBottom,
  );
  doc.text(
    "TOT",
    subX + sem1SubWidths[0] + sem1SubWidths[1] + sem1SubWidths[2] / 2,
    tableY + hTop + shiftY + (hMid + hBottom) / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX,
    tableY + hTop + hMid + shiftY,
    sem1PeriodWidths[0],
    hBottom,
  );
  doc.text(
    "1eP",
    subX + sem1PeriodWidths[0] / 2,
    tableY + hTop + hMid + shiftY + hBottom / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX + sem1PeriodWidths[0],
    tableY + hTop + hMid + shiftY,
    sem1PeriodWidths[1],
    hBottom,
  );
  doc.text(
    "2eP",
    subX + sem1PeriodWidths[0] + sem1PeriodWidths[1] / 2,
    tableY + hTop + hMid + shiftY + hBottom / 2,
    { align: "center", baseline: "middle" },
  );

  const xSS = colPos[2];
  doc.rect(xSS + shiftX, tableY + shiftY, colWidths[2], hTop);
  doc.text(
    "DEUXIEME SEMESTRE",
    xSS + shiftX + colWidths[2] / 2,
    tableY + shiftY + hTop / 2,
    { align: "center", baseline: "middle" },
  );

  subX = xSS + shiftX;
  doc.rect(subX, tableY + hTop + shiftY, sem2SubWidths[0], hMid + hBottom);
  doc.text(
    "TR JOURN",
    subX + sem2SubWidths[0] / 2,
    tableY + hTop + shiftY + hMid / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX + sem2SubWidths[0],
    tableY + hTop + shiftY,
    sem2SubWidths[1],
    hMid + hBottom,
  );
  doc.text(
    "EXAM",
    subX + sem2SubWidths[0] + sem2SubWidths[1] / 2,
    tableY + hTop + shiftY + (hMid + hBottom) / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX + sem2SubWidths[0] + sem2SubWidths[1],
    tableY + hTop + shiftY,
    sem2SubWidths[2],
    hMid + hBottom,
  );
  doc.text(
    "TOT",
    subX + sem2SubWidths[0] + sem2SubWidths[1] + sem2SubWidths[2] / 2,
    tableY + hTop + shiftY + (hMid + hBottom) / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX,
    tableY + hTop + hMid + shiftY,
    sem2PeriodWidths[0],
    hBottom,
  );
  doc.text(
    "3eP",
    subX + sem2PeriodWidths[0] / 2,
    tableY + hTop + hMid + shiftY + hBottom / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX + sem2PeriodWidths[0],
    tableY + hTop + hMid + shiftY,
    sem2PeriodWidths[1],
    hBottom,
  );
  doc.text(
    "4eP",
    subX + sem2PeriodWidths[0] + sem2PeriodWidths[1] / 2,
    tableY + hTop + hMid + shiftY + hBottom / 2,
    { align: "center", baseline: "middle" },
  );

  doc.rect(
    colPos[3] + shiftX,
    tableY + shiftY,
    colWidths[3],
    rowHeightTotal,
  );
  doc.text(
    "TG",
    colPos[3] + shiftX + colWidths[3] / 2,
    tableY + shiftY + rowHeightTotal / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    colPos[4] + shiftX,
    tableY + shiftY,
    colWidths[4],
    rowHeightTotal,
  );
  doc.text(
    "SIGN PROF",
    colPos[4] + shiftX + colWidths[4] / 2,
    tableY + shiftY + rowHeightTotal / 2,
    { align: "center", baseline: "middle" },
  );
  doc.setDrawColor(0, 0, 0);
  doc.rect(colPos[5] + shiftX, tableY + shiftY, spacerWidth, rowHeightTotal, "F");
  doc.rect(colPos[6] + shiftX, tableY + shiftY, repechageWidth, rowHeightTotal);
  doc.setFontSize(8);
  doc.text(
    ["EXAMEN DE", "REPECHAGE"],
    colPos[6] + shiftX + colWidths[0] / 2,
    tableY + shiftY + rowHeightTotal / 2 - 5,
    { align: "center", baseline: "middle" },
  );

  const frameHeight = 6;
  const bottomY = tableY + shiftY + rowHeightTotal - frameHeight;

  doc.rect(colPos[6] + shiftX, bottomY, repechagePercentWidth, frameHeight);
  doc.text(
    "%",
    colPos[6] + shiftX + repechagePercentWidth / 2,
    bottomY + frameHeight / 2,
    { align: "center", baseline: "middle" },
  );

  doc.rect(
    colPos[6] + shiftX + repechagePercentWidth,
    bottomY,
    repechageSignatureWidth,
    frameHeight,
  );
  doc.text(
    "Signature",
    colPos[6] + shiftX + repechagePercentWidth + repechageSignatureWidth / 2,
    bottomY + frameHeight / 2,
    { align: "center", baseline: "middle" },
  );

  doc.restoreGraphicsState();
}

export { MIN_EVAL_CELL_WIDTH_MM };
