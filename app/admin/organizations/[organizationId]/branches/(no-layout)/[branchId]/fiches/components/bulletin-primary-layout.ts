import type { jsPDF } from "jspdf";

import { drawCell1 } from "@/lib/types";
import {
  BULLETIN_INNER_LINE_WIDTH_MM,
  BULLETIN_PAGE_MARGIN_MM,
  MIN_EVAL_CELL_WIDTH_MM,
  computeColumnPositions,
  getBulletinFrameWidth,
  scaleRatiosToWidths,
  splitWidthByRatios,
} from "@/lib/bulletin-layout";
import {
  PRIMARY_EVAL_CELL_COUNT,
  PRIMARY_EVAL_COLUMNS,
  PRIMARY_FINAL_COL_INDEX,
  PRIMARY_FINAL_SUB_RATIOS,
  PRIMARY_MAIN_COL_RATIOS,
  getTrimesterColumnDefs,
  getTrimesterSubRatios,
  TRIMESTER_HEADER_LABELS,
  type PrimaryColumnDef,
} from "@/lib/primary-bulletin-columns";

export {
  PRIMARY_EVAL_CELL_COUNT,
  PRIMARY_EVAL_COLUMNS,
  PRIMARY_FINAL_COL_INDEX,
  PRIMARY_MAIN_COL_RATIOS,
} from "@/lib/primary-bulletin-columns";

/** @deprecated Use PRIMARY_FINAL_COL_INDEX */
export const PRIMARY_TG_COL_INDEX = PRIMARY_FINAL_COL_INDEX;

export type PrimaryEvalCellLayout = PrimaryColumnDef & {
  x: number;
  width: number;
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
  evalCells: PrimaryEvalCellLayout[];
  finalMaxWidth: number;
  finalPtsWidth: number;
  finalMaxX: number;
  finalPtsX: number;
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

function buildEvalCells(
  colPos: number[],
  colWidths: number[],
  shiftX: number,
): PrimaryEvalCellLayout[] {
  const cells: PrimaryEvalCellLayout[] = [];

  for (const trimesterIndex of [1, 2, 3] as const) {
    const colIndex = trimesterIndex;
    const baseX = colPos[colIndex] + shiftX;
    const subWidths = splitWidthByRatios(
      colWidths[colIndex],
      [...getTrimesterSubRatios(trimesterIndex)],
    );
    const defs = getTrimesterColumnDefs(trimesterIndex);
    let offset = 0;

    for (let i = 0; i < defs.length; i++) {
      cells.push({
        ...defs[i],
        x: baseX + offset,
        width: subWidths[i],
      });
      offset += subWidths[i];
    }
  }

  const finalBaseX = colPos[PRIMARY_FINAL_COL_INDEX] + shiftX;
  const finalWidths = splitWidthByRatios(
    colWidths[PRIMARY_FINAL_COL_INDEX],
    [...PRIMARY_FINAL_SUB_RATIOS],
  );
  const finalDefs = PRIMARY_EVAL_COLUMNS.filter((col) => col.trimesterIndex === 0);

  cells.push({
    ...finalDefs[0],
    x: finalBaseX,
    width: finalWidths[0],
  });
  cells.push({
    ...finalDefs[1],
    x: finalBaseX + finalWidths[0],
    width: finalWidths[1],
  });

  return cells;
}

export function buildPrimaryBulletinLayout(
  params: BuildPrimaryLayoutParams,
): PrimaryBulletinLayout {
  const margin = params.margin ?? BULLETIN_PAGE_MARGIN_MM;
  const frameWidth = getBulletinFrameWidth(params.pageWidth, margin);
  const tableX = params.tableX ?? margin;
  const shiftX = params.shiftX ?? 0;

  const colWidths = scaleRatiosToWidths([...PRIMARY_MAIN_COL_RATIOS], frameWidth);
  const colPos = computeColumnPositions(tableX, colWidths);
  const evalCells = buildEvalCells(colPos, colWidths, shiftX);
  const finalMax = evalCells.find((cell) => cell.key === "final-max")!;
  const finalPts = evalCells.find((cell) => cell.key === "final-pts")!;

  return {
    frameWidth,
    tableX,
    shiftX,
    tableY: params.tableY ?? 0,
    shiftY: params.shiftY ?? 0,
    rowHeightTotal: params.rowHeightTotal ?? 14,
    hTop: params.hTop ?? 8,
    hMid: params.hMid ?? 6,
    hBottom: params.hBottom ?? 0,
    colWidths,
    colPos,
    evalCells,
    finalMaxWidth: finalMax.width,
    finalPtsWidth: finalPts.width,
    finalMaxX: finalMax.x,
    finalPtsX: finalPts.x,
  };
}

export function getPrimaryEvaluationCellWidths(
  layout: PrimaryBulletinLayout,
): number[] {
  return layout.evalCells.map((cell) => cell.width);
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
  maxAnnuel?: number | string;
};

function maximaValueForCell(
  cell: PrimaryEvalCellLayout,
  values: PrimaryTrimesterMaximaValues,
): string {
  switch (cell.kind) {
    case "max-per":
      return String(values.p1 ?? "");
    case "max-exam":
      if (cell.maximaKey === "exam1") return String(values.exam1 ?? "");
      if (cell.maximaKey === "exam2") return String(values.exam2 ?? "");
      if (cell.maximaKey === "exam3") return String(values.exam3 ?? "");
      return "";
    case "max-trim":
      if (cell.trimesterIndex === 1) return String(values.tt1 ?? "");
      if (cell.trimesterIndex === 2) return String(values.tt2 ?? "");
      if (cell.trimesterIndex === 3) return String(values.tt3 ?? "");
      return "";
    case "max-total":
      return String(values.maxAnnuel ?? "");
    default:
      return "";
  }
}

export function getPrimaryMaximaCellText(
  cell: PrimaryEvalCellLayout,
  values: PrimaryTrimesterMaximaValues,
): string {
  return maximaValueForCell(cell, values);
}

export function drawPrimaryTrimesterMaximaRow(
  doc: jsPDF,
  y: number,
  values: PrimaryTrimesterMaximaValues,
  layout: PrimaryBulletinLayout,
  maximaHeight: number,
  options?: { plain?: boolean },
): void {
  const plain = options?.plain ?? false;

  for (const cell of layout.evalCells) {
    const text = maximaValueForCell(cell, values);
    if (plain) {
      doc.setFont("helvetica", "bold");
      drawCell1(doc, cell.x, y, cell.width, maximaHeight, text, {
        isMaxima: false,
        color: "black",
        fill: "white",
      });
      doc.setFont("helvetica", "normal");
      continue;
    }

    drawCell1(doc, cell.x, y, cell.width, maximaHeight, text, {
      isMaxima: true,
    });
  }
}

function parseSubHeaderLines(label: string): { line1: string; line2?: string } {
  if (label === "MAX") {
    return { line1: "MAX" };
  }
  if (label === "PTS OBT") {
    return { line1: "PTS", line2: "OBT" };
  }
  const periodMatch = label.match(/^(\d+e?r?)P$/i);
  if (periodMatch) {
    const numPart = label.slice(0, -1);
    return { line1: numPart, line2: "Per" };
  }
  return { line1: label };
}

function drawSubHeaderLabel(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  kind?: PrimaryColumnDef["kind"],
) {
  const { line1, line2 } = parseSubHeaderLines(label);
  const centerX = x + width / 2;
  const isTrimPair = kind === "max-trim" || kind === "pts-trim";

  if (line2) {
    const isPeriod = line2 === "Per";
    doc.setFontSize(isPeriod ? 4 : isTrimPair ? 4 : 4.5);
    doc.text(line1, centerX, y + height * 0.32, { align: "center", baseline: "middle" });
    doc.text(line2, centerX, y + height * 0.72, { align: "center", baseline: "middle" });
    return;
  }

  doc.setFontSize(isTrimPair ? 4.5 : 5.5);
  doc.text(line1, centerX, y + height / 2, { align: "center", baseline: "middle" });
}

function drawFlatTrimesterHeader(
  doc: jsPDF,
  layout: PrimaryBulletinLayout,
  trimesterIndex: 1 | 2 | 3,
) {
  const { shiftX, tableY, shiftY, hTop, hMid, hBottom, colWidths, colPos } = layout;
  const colIndex = trimesterIndex;
  const xTrim = colPos[colIndex] + shiftX;
  const trimWidth = colWidths[colIndex];
  const label = TRIMESTER_HEADER_LABELS[trimesterIndex];
  const defs = getTrimesterColumnDefs(trimesterIndex);
  const subWidths = splitWidthByRatios(trimWidth, [...getTrimesterSubRatios(trimesterIndex)]);
  const subHeaderHeight = hMid + hBottom;

  doc.rect(xTrim, tableY + shiftY, trimWidth, hTop);
  doc.setFontSize(6.5);
  doc.text(label, xTrim + trimWidth / 2, tableY + shiftY + hTop / 2, {
    align: "center",
    baseline: "middle",
  });

  let subX = xTrim;
  for (let i = 0; i < defs.length; i++) {
    doc.rect(subX, tableY + hTop + shiftY, subWidths[i], subHeaderHeight);
    drawSubHeaderLabel(
      doc,
      subX,
      tableY + hTop + shiftY,
      subWidths[i],
      subHeaderHeight,
      defs[i].label,
      defs[i].kind,
    );
    subX += subWidths[i];
  }
}

function drawFinalColumnHeader(doc: jsPDF, layout: PrimaryBulletinLayout) {
  const { shiftX, tableY, shiftY, hTop, hMid, hBottom, colWidths, colPos } = layout;
  const xFinal = colPos[PRIMARY_FINAL_COL_INDEX] + shiftX;
  const finalWidth = colWidths[PRIMARY_FINAL_COL_INDEX];
  const subWidths = splitWidthByRatios(finalWidth, [...PRIMARY_FINAL_SUB_RATIOS]);
  const subHeaderHeight = hMid + hBottom;

  doc.rect(xFinal, tableY + shiftY, finalWidth, hTop);
  doc.setFontSize(6.5);
  doc.text("TOTAL", xFinal + finalWidth / 2, tableY + shiftY + hTop / 2, {
    align: "center",
    baseline: "middle",
  });

  doc.rect(xFinal, tableY + hTop + shiftY, subWidths[0], subHeaderHeight);
  drawSubHeaderLabel(
    doc,
    xFinal,
    tableY + hTop + shiftY,
    subWidths[0],
    subHeaderHeight,
    "MAX",
  );

  doc.rect(xFinal + subWidths[0], tableY + hTop + shiftY, subWidths[1], subHeaderHeight);
  drawSubHeaderLabel(
    doc,
    xFinal + subWidths[0],
    tableY + hTop + shiftY,
    subWidths[1],
    subHeaderHeight,
    "PTS OBT",
  );
}

export function drawPrimaryTableHeader(
  doc: jsPDF,
  layout: PrimaryBulletinLayout,
): void {
  const { tableX, shiftX, tableY, shiftY, rowHeightTotal, colWidths, colPos } = layout;

  doc.saveGraphicsState();
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(BULLETIN_INNER_LINE_WIDTH_MM);

  doc.rect(tableX + shiftX, tableY + shiftY, layout.frameWidth, rowHeightTotal);

  doc.rect(colPos[0] + shiftX, tableY + shiftY, colWidths[0], rowHeightTotal);
  doc.setFontSize(6.5);
  doc.text("BRANCHES", colPos[0] + shiftX + colWidths[0] / 2, tableY + shiftY + rowHeightTotal / 2, {
    align: "center",
    baseline: "middle",
  });

  drawFlatTrimesterHeader(doc, layout, 1);
  drawFlatTrimesterHeader(doc, layout, 2);
  drawFlatTrimesterHeader(doc, layout, 3);
  drawFinalColumnHeader(doc, layout);

  doc.restoreGraphicsState();
}

export { MIN_EVAL_CELL_WIDTH_MM };

/** Primaire v2 : 21 cellules — seuil réduit pour tenir en A4 portrait. */
export const PRIMARY_MIN_EVAL_CELL_WIDTH_MM = 6.5;

/** Colonnes période (1erP, 2eP…) volontairement plus étroites. */
export const PRIMARY_MIN_PERIOD_CELL_WIDTH_MM = 4.5;

/** Colonnes MAX : libellé court « MAX » (3 lettres). */
export const PRIMARY_MIN_MAX_CELL_WIDTH_MM = 5;
