import type { jsPDF } from "jspdf";

import { drawCell1 } from "@/lib/types";
import {
  BULLETIN_PAGE_MARGIN_MM,
  MIN_EVAL_CELL_WIDTH_MM,
  computeColumnPositions,
  getBulletinFrameWidth,
  scaleRatiosToWidths,
  splitWidthByRatios,
} from "@/lib/bulletin-layout";

/**
 * Colonnes principales : COURS | TRIM1 | TRIM2 | TRIM3 | TG
 * Cinq colonnes — sans SIGN PROF, spacer ni repechage (phase B).
 */
export const PRIMARY_MAIN_COL_RATIOS = [0.17, 0.22, 0.22, 0.22, 0.17];

/** Index de la colonne TG dans le layout primaire. */
export const PRIMARY_TG_COL_INDEX = 4;

/** Sous-colonnes d'un trimestre : TR JOURN (périodes) | EXAM | TOT */
export const PRIMARY_TRIM_SUB_RATIOS = [0.46, 0.27, 0.27];

/** Répartition des deux périodes dans TR JOURN */
export const PRIMARY_PERIOD_RATIOS = [0.5, 0.5];

export type PrimaryTrimesterSubLayout = {
  subWidths: number[];
  periodWidths: number[];
  totX: number;
  examX: number;
};

export type PrimaryBulletinLayout = {
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
  trim1: PrimaryTrimesterSubLayout;
  trim2: PrimaryTrimesterSubLayout;
  trim3: PrimaryTrimesterSubLayout;
};

export type BuildPrimaryLayoutParams = {
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

function buildTrimesterSubLayout(
  trimColIndex: number,
  colPos: number[],
  colWidths: number[],
  shiftX: number,
): PrimaryTrimesterSubLayout {
  const subWidths = splitWidthByRatios(
    colWidths[trimColIndex],
    PRIMARY_TRIM_SUB_RATIOS,
  );
  const periodWidths = splitWidthByRatios(subWidths[0], PRIMARY_PERIOD_RATIOS);
  const totX = colPos[trimColIndex] + shiftX + subWidths[0];
  const examX = totX + subWidths[1];

  return { subWidths, periodWidths, totX, examX };
}

export function buildPrimaryBulletinLayout(
  params: BuildPrimaryLayoutParams,
): PrimaryBulletinLayout {
  const margin = params.margin ?? BULLETIN_PAGE_MARGIN_MM;
  const frameWidth = getBulletinFrameWidth(params.pageWidth, margin);
  const tableX = params.tableX ?? margin;
  const shiftX = params.shiftX ?? 0;

  const colWidths = scaleRatiosToWidths(PRIMARY_MAIN_COL_RATIOS, frameWidth);
  const colPos = computeColumnPositions(tableX, colWidths);

  const trim1 = buildTrimesterSubLayout(1, colPos, colWidths, shiftX);
  const trim2 = buildTrimesterSubLayout(2, colPos, colWidths, shiftX);
  const trim3 = buildTrimesterSubLayout(3, colPos, colWidths, shiftX);

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
    trim1,
    trim2,
    trim3,
  };
}

/** Retourne les neuf largeurs des cases d'évaluation (P1–P6 + EXAM 1–3). */
export function getPrimaryEvaluationCellWidths(
  layout: PrimaryBulletinLayout,
): number[] {
  return [
    layout.trim1.periodWidths[0],
    layout.trim1.periodWidths[1],
    layout.trim1.subWidths[1],
    layout.trim2.periodWidths[0],
    layout.trim2.periodWidths[1],
    layout.trim2.subWidths[1],
    layout.trim3.periodWidths[0],
    layout.trim3.periodWidths[1],
    layout.trim3.subWidths[1],
  ];
}

export type PrimaryTrimesterMaximaValues = {
  p1?: number | string;
  p2?: number | string;
  exam1?: number | string;
  tt1?: number | string;
  p3?: number | string;
  p4?: number | string;
  exam2?: number | string;
  tt2?: number | string;
  p5?: number | string;
  p6?: number | string;
  exam3?: number | string;
  tt3?: number | string;
};

export function drawPrimaryTrimesterMaximaRow(
  doc: jsPDF,
  y: number,
  values: PrimaryTrimesterMaximaValues,
  layout: PrimaryBulletinLayout,
  maximaHeight: number,
): void {
  const { colPos, shiftX, trim1, trim2, trim3 } = layout;

  const cells: [number, number, number | string | undefined][] = [
    [colPos[1] + shiftX, trim1.periodWidths[0], values.p1],
    [colPos[1] + shiftX + trim1.periodWidths[0], trim1.periodWidths[1], values.p2],
    [trim1.totX, trim1.subWidths[1], values.exam1],
    [trim1.examX, trim1.subWidths[2], values.tt1],
    [colPos[2] + shiftX, trim2.periodWidths[0], values.p3],
    [colPos[2] + shiftX + trim2.periodWidths[0], trim2.periodWidths[1], values.p4],
    [trim2.totX, trim2.subWidths[1], values.exam2],
    [trim2.examX, trim2.subWidths[2], values.tt2],
    [colPos[3] + shiftX, trim3.periodWidths[0], values.p5],
    [colPos[3] + shiftX + trim3.periodWidths[0], trim3.periodWidths[1], values.p6],
    [trim3.totX, trim3.subWidths[1], values.exam3],
    [trim3.examX, trim3.subWidths[2], values.tt3],
  ];

  for (const [x, w, value] of cells) {
    drawCell1(doc, x, y, w, maximaHeight, String(value ?? ""), {
      isMaxima: true,
    });
  }
}

export function getPrimaryTrimesterDrawConfig(
  layout: PrimaryBulletinLayout,
  maximaHeight: number,
) {
  return {
    colPos: layout.colPos,
    shiftX: layout.shiftX,
    trim1PeriodWidths: layout.trim1.periodWidths,
    trim2PeriodWidths: layout.trim2.periodWidths,
    trim3PeriodWidths: layout.trim3.periodWidths,
    trim1SubWidths: layout.trim1.subWidths,
    trim2SubWidths: layout.trim2.subWidths,
    trim3SubWidths: layout.trim3.subWidths,
    totX1: layout.trim1.totX,
    totX2: layout.trim2.totX,
    totX3: layout.trim3.totX,
    examX1: layout.trim1.examX,
    examX2: layout.trim2.examX,
    examX3: layout.trim3.examX,
    maximaHeight,
  };
}

function drawTrimesterHeader(
  doc: jsPDF,
  layout: PrimaryBulletinLayout,
  trimColIndex: number,
  trimLabel: string,
  periodLabels: [string, string],
) {
  const {
    shiftX,
    tableY,
    shiftY,
    hTop,
    hMid,
    hBottom,
    colWidths,
    colPos,
  } = layout;

  const trim = [layout.trim1, layout.trim2, layout.trim3][trimColIndex - 1];
  const xTrim = colPos[trimColIndex];

  doc.rect(xTrim + shiftX, tableY + shiftY, colWidths[trimColIndex], hTop);
  doc.text(
    trimLabel,
    xTrim + shiftX + colWidths[trimColIndex] / 2,
    tableY + shiftY + hTop / 2,
    { align: "center", baseline: "middle" },
  );

  let subX = xTrim + shiftX;
  doc.rect(subX, tableY + hTop + shiftY, trim.subWidths[0], hMid + hBottom);
  doc.text(
    "TR JOURN",
    subX + trim.subWidths[0] / 2,
    tableY + hTop + shiftY + hMid / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX + trim.subWidths[0],
    tableY + hTop + shiftY,
    trim.subWidths[1],
    hMid + hBottom,
  );
  doc.text(
    "EXAM",
    subX + trim.subWidths[0] + trim.subWidths[1] / 2,
    tableY + hTop + shiftY + (hMid + hBottom) / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX + trim.subWidths[0] + trim.subWidths[1],
    tableY + hTop + shiftY,
    trim.subWidths[2],
    hMid + hBottom,
  );
  doc.text(
    "TOT",
    subX + trim.subWidths[0] + trim.subWidths[1] + trim.subWidths[2] / 2,
    tableY + hTop + shiftY + (hMid + hBottom) / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX,
    tableY + hTop + hMid + shiftY,
    trim.periodWidths[0],
    hBottom,
  );
  doc.text(
    periodLabels[0],
    subX + trim.periodWidths[0] / 2,
    tableY + hTop + hMid + shiftY + hBottom / 2,
    { align: "center", baseline: "middle" },
  );
  doc.rect(
    subX + trim.periodWidths[0],
    tableY + hTop + hMid + shiftY,
    trim.periodWidths[1],
    hBottom,
  );
  doc.text(
    periodLabels[1],
    subX + trim.periodWidths[0] + trim.periodWidths[1] / 2,
    tableY + hTop + hMid + shiftY + hBottom / 2,
    { align: "center", baseline: "middle" },
  );
}

export function drawPrimaryTableHeader(
  doc: jsPDF,
  layout: PrimaryBulletinLayout,
): void {
  const {
    tableX,
    shiftX,
    tableY,
    shiftY,
    rowHeightTotal,
    colWidths,
    colPos,
  } = layout;

  doc.rect(tableX + shiftX, tableY + shiftY, layout.frameWidth, rowHeightTotal);

  doc.rect(
    colPos[0] + shiftX,
    tableY + shiftY,
    colWidths[0],
    rowHeightTotal,
  );
  doc.setFontSize(8);
  doc.text(
    "COURS",
    colPos[0] + shiftX + colWidths[0] / 2,
    tableY + shiftY + rowHeightTotal / 2,
    { align: "center", baseline: "middle" },
  );

  drawTrimesterHeader(doc, layout, 1, "1er TRIMESTRE", ["1eP", "2eP"]);
  drawTrimesterHeader(doc, layout, 2, "2e TRIMESTRE", ["3eP", "4eP"]);
  drawTrimesterHeader(doc, layout, 3, "3e TRIMESTRE", ["5eP", "6eP"]);

  doc.rect(
    colPos[PRIMARY_TG_COL_INDEX] + shiftX,
    tableY + shiftY,
    colWidths[PRIMARY_TG_COL_INDEX],
    rowHeightTotal,
  );
  doc.text(
    "TG",
    colPos[PRIMARY_TG_COL_INDEX] + shiftX + colWidths[PRIMARY_TG_COL_INDEX] / 2,
    tableY + shiftY + rowHeightTotal / 2,
    { align: "center", baseline: "middle" },
  );
}

export { MIN_EVAL_CELL_WIDTH_MM };
