import type { jsPDF } from "jspdf";
import type { ManagedBranchType } from "@/lib/academic-structure";
import {
  calculateBulletinYearMaxima,
  getBulletinGroupMaxima,
  type BulletinPeriodMaxima,
} from "@/lib/bulletin-maxima";
import {
  PRIMARY_FINAL_COL_INDEX,
} from "@/lib/primary-bulletin-columns";
import {
  BULLETIN_INNER_LINE_WIDTH_MM,
} from "@/lib/bulletin-layout";
import {
  canShowGroupTotal,
  computeGroupTotal,
  type Subject,
} from "@/lib/types";

import {
  type PrimaryBulletinLayout,
  type PrimaryEvalCellLayout,
  type PrimaryTrimesterMaximaValues,
  drawPrimaryTrimesterMaximaRow,
  getPrimaryMaximaCellText,
} from "./bulletin-primary-layout";

type DrawCellFn = (
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  isMaxima?: boolean,
  align?: "left" | "center" | "right",
  color?:
    | "black"
    | "white"
    | "red"
    | "blue"
    | "green"
    | {
        text?: string;
        fill?: string;
        bold?: boolean;
        fontSize?: number;
        /** Motif tirets diagonaux (cells bloquées CONDUITE). */
        hatch?: "dashed";
      },
  borders?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  },
) => void;

type GetColorFn = (value: number, type: string, max: number) => string;

const DOMAIN_HEADER_FILL_RGB: [number, number, number] = [235, 235, 235];
const PERIOD_SCORE_STYLE = { fontSize: 7 } as const;

export function drawPrimaryDomainHeader(
  doc: jsPDF,
  layout: PrimaryBulletinLayout,
  y: number,
  height: number,
  label: string,
) {
  const x = layout.tableX + layout.shiftX;
  const w = layout.frameWidth;

  doc.setFillColor(...DOMAIN_HEADER_FILL_RGB);
  doc.rect(x, y, w, height, "F");

  doc.saveGraphicsState();
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(BULLETIN_INNER_LINE_WIDTH_MM);
  doc.line(x, y, x + w, y);
  doc.line(x, y + height, x + w, y + height);
  doc.line(x, y, x, y + height);
  doc.line(x + w, y, x + w, y + height);
  doc.restoreGraphicsState();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text(label.toUpperCase(), x + w / 2, y + height / 2, {
    align: "center",
    baseline: "middle",
  });
}

function drawBranchesCell(
  drawCell: DrawCellFn,
  layout: PrimaryBulletinLayout,
  y: number,
  height: number,
  text: string,
  align: "left" | "center" = "left",
  bold = false,
  fill: { text?: string; fill?: string; bold?: boolean } = {
    text: "black",
    fill: "white",
  },
) {
  const { colPos, shiftX, colWidths } = layout;
  drawCell(
    colPos[0] + shiftX,
    y,
    colWidths[0],
    height,
    bold ? text.toUpperCase() : text,
    false,
    align,
    { ...fill, bold: bold || fill.bold },
  );
}

function drawEmptyEvalCells(
  drawCell: DrawCellFn,
  layout: PrimaryBulletinLayout,
  y: number,
  height: number,
  fill: { text?: string; fill?: string } = { text: "black", fill: "white" },
) {
  for (const cell of layout.evalCells) {
    drawCell(cell.x, y, cell.width, height, "", false, "center", fill);
  }
}

function getPeriodScore(
  subject: Subject,
  periodKey: string,
  activePeriodKeys: string[],
): { text: string; value: number; max: number } {
  const semester =
    periodKey === "p1" || periodKey === "p2" || periodKey === "exam1"
      ? subject.sem1
      : periodKey === "p3" || periodKey === "p4" || periodKey === "exam2"
        ? subject.sem2
        : subject.sem3 ?? {};
  const value = Number((semester as Record<string, number>)[periodKey] ?? 0);
  const maxima = (subject as Subject & { maxima?: Record<string, number> }).maxima;
  const max =
    maxima?.[periodKey as keyof typeof maxima] ??
    (periodKey.startsWith("exam") ? subject.baseMaxScore * 2 : subject.baseMaxScore);

  return {
    value,
    max: Number(max) || subject.baseMaxScore,
    text: activePeriodKeys.includes(periodKey) && value !== 0 ? String(value) : "",
  };
}

function getTrimesterGroupOrder(trimesterIndex: 1 | 2 | 3): 1 | 2 | 3 {
  return trimesterIndex;
}

function getTrimesterMax(
  subject: Subject & { maxima?: Record<string, number> },
  trimesterIndex: 1 | 2 | 3,
  maximaTot1: number,
  maximaTot2: number,
  maximaTot3: number,
): number {
  if (trimesterIndex === 1) return maximaTot1;
  if (trimesterIndex === 2) return maximaTot2;
  return maximaTot3;
}

export function drawPrimarySectionHeader(
  drawCell: DrawCellFn,
  layout: PrimaryBulletinLayout,
  y: number,
  height: number,
  label: string,
) {
  drawBranchesCell(drawCell, layout, y, height, label, "left", true);
  drawEmptyEvalCells(drawCell, layout, y, height);
}

export function drawPrimarySousTotalRow(
  drawCell: DrawCellFn,
  doc: Parameters<typeof drawPrimaryTrimesterMaximaRow>[0],
  layout: PrimaryBulletinLayout,
  y: number,
  height: number,
  label: string,
  values: PrimaryTrimesterMaximaValues,
) {
  drawBranchesCell(drawCell, layout, y, height, label, "left", true);
  drawPrimaryTrimesterMaximaRow(doc, y, values, layout, height, { plain: true });
}

export function drawPrimaryGeneralMaximaRow(
  drawCell: DrawCellFn,
  _doc: Parameters<typeof drawPrimaryTrimesterMaximaRow>[0],
  layout: PrimaryBulletinLayout,
  y: number,
  height: number,
  values: PrimaryTrimesterMaximaValues,
  /** Totaux obtenus (ligne TOTAUX) à afficher dans les colonnes PTS OBT — pas de ligne TOTAUX séparée. */
  totauxPtsByCell: Partial<Record<string, string>> = {},
  getColor?: GetColorFn,
) {
  drawBranchesCell(drawCell, layout, y, height, "MAXIMA GÉNÉRAL", "left", true);

  const maxForPtsCell = (cell: (typeof layout.evalCells)[number]): number => {
    if (cell.kind === "period-score" && cell.periodKey) {
      const key = cell.periodKey as keyof PrimaryTrimesterMaximaValues;
      return Number(values[key] ?? 0) || 0;
    }
    if (cell.kind === "pts-exam") {
      if (cell.trimesterIndex === 1) return Number(values.exam1 ?? 0) || 0;
      if (cell.trimesterIndex === 2) return Number(values.exam2 ?? 0) || 0;
      return Number(values.exam3 ?? 0) || 0;
    }
    if (cell.kind === "pts-trim") {
      if (cell.trimesterIndex === 1) return Number(values.tt1 ?? 0) || 0;
      if (cell.trimesterIndex === 2) return Number(values.tt2 ?? 0) || 0;
      return Number(values.tt3 ?? 0) || 0;
    }
    if (cell.kind === "pts-total") {
      return Number(values.maxAnnuel ?? 0) || 0;
    }
    return 0;
  };

  for (const cell of layout.evalCells) {
    const isMaxCell =
      cell.kind === "max-per" ||
      cell.kind === "max-exam" ||
      cell.kind === "max-trim" ||
      cell.kind === "max-total";
    const text = isMaxCell
      ? getPrimaryMaximaCellText(cell, values)
      : (totauxPtsByCell[cell.key] ?? "");

    let textColor = "black";
    if (!isMaxCell && text && getColor) {
      const value = Number.parseFloat(text.replace(",", ".")) || 0;
      textColor = getColor(value, "score", maxForPtsCell(cell));
    }

    drawCell(cell.x, y, cell.width, height, text, false, "center", {
      text: textColor,
      fill: "white",
      bold: true,
    });
  }
}

export function drawPrimaryMatiere(
  drawCell: DrawCellFn,
  yPosBlocs: number,
  layout: PrimaryBulletinLayout,
  maximaHeight: number,
  subject: Subject & { maxima?: Record<string, number> },
  activePeriodKeys: string[],
  getColor: GetColorFn,
  branchType: ManagedBranchType,
  maximaTot1: number,
  maximaTot2: number,
  maximaTot3: number,
  maximaAnnuel: number,
) {
  const courseMaxima = buildPrimaryMaximaValues(
    (subject.maxima ?? {}) as BulletinPeriodMaxima,
  );

  drawBranchesCell(drawCell, layout, yPosBlocs, maximaHeight, subject.name, "left", true);

  for (const cell of layout.evalCells) {
    let text = "";
    let color: { text: string; fill: string; bold?: boolean; fontSize?: number } = {
      text: "black",
      fill: "white",
    };

    if (
      cell.kind === "max-per" ||
      cell.kind === "max-exam" ||
      cell.kind === "max-trim" ||
      cell.kind === "max-total"
    ) {
      text = getPrimaryMaximaCellText(cell, courseMaxima);
      // Même style que sous-total (plain) : noir + gras
      color = { text: "black", fill: "white", bold: true };
    } else if (cell.kind === "period-score" && cell.periodKey) {
      const score = getPeriodScore(subject, cell.periodKey, activePeriodKeys);
      text = score.text;
      color = {
        text: getColor(score.value, "score", score.max),
        fill: "white",
        ...PERIOD_SCORE_STYLE,
      };
    } else if (cell.kind === "pts-exam" && cell.periodKey) {
      const score = getPeriodScore(subject, cell.periodKey, activePeriodKeys);
      text = score.text;
      color = { text: getColor(score.value, "score", score.max), fill: "white" };
    } else if (cell.kind === "pts-trim" && cell.trimesterIndex >= 1 && cell.trimesterIndex <= 3) {
      const trimesterIndex = cell.trimesterIndex as 1 | 2 | 3;
      const groupOrder = getTrimesterGroupOrder(trimesterIndex);
      const groupTotal = computeGroupTotal(subject, groupOrder, activePeriodKeys, branchType);
      const max = getTrimesterMax(subject, trimesterIndex, maximaTot1, maximaTot2, maximaTot3);
      if (canShowGroupTotal(groupOrder, activePeriodKeys, branchType) && groupTotal !== 0) {
        text = String(groupTotal);
        color = { text: getColor(groupTotal, "score", max), fill: "white" };
      }
    } else if (cell.kind === "pts-total") {
      const tt1 = computeGroupTotal(subject, 1, activePeriodKeys, branchType);
      const tt2 = computeGroupTotal(subject, 2, activePeriodKeys, branchType);
      const tt3 = computeGroupTotal(subject, 3, activePeriodKeys, branchType);
      const canAnnuel =
        canShowGroupTotal(1, activePeriodKeys, branchType) &&
        canShowGroupTotal(2, activePeriodKeys, branchType) &&
        canShowGroupTotal(3, activePeriodKeys, branchType);
      const annuel = tt1 > 0 && tt2 > 0 && tt3 > 0 && canAnnuel ? tt1 + tt2 + tt3 : 0;
      if (annuel !== 0) {
        text = String(annuel);
        color = { text: getColor(annuel, "score", maximaAnnuel), fill: "white" };
      }
    }

    drawCell(cell.x, yPosBlocs, cell.width, maximaHeight, text, false, "center", color);
  }

  return yPosBlocs + maximaHeight;
}

export function drawPrimarySubjectRow(
  drawCell: DrawCellFn,
  yPosBlocs: number,
  layout: PrimaryBulletinLayout,
  maximaHeight: number,
  subject: { name: string },
  autresByPeriod: Record<string, Record<string, Record<string, Record<string, unknown>>>>,
  generalesMaxima: {
    p1: number;
    p2: number;
    exam1?: number;
    tt1: number;
    p3: number;
    p4: number;
    exam2?: number;
    tt2: number;
    p5: number;
    p6: number;
    exam3?: number;
    tt3: number;
    tg: number;
  },
  getColor: GetColorFn,
  _safeStr: (val: unknown) => string,
  isGeneraux?: boolean,
) {
  const blank = { text: "white", fill: "white" } as const;
  const whiteFill = { text: "black", fill: "white" } as const;
  const maximaBlack = { text: "white", fill: "black" } as const;

  if (!isGeneraux || subject.name === "TOTAUX") {
    return yPosBlocs;
  }

  if (subject.name === "SIGNATURE PARENTS") {
    drawBranchesCell(drawCell, layout, yPosBlocs, maximaHeight, subject.name, "left");

    // Une zone de signature par trimestre (+ colonne finale), sans fusion globale.
    const signatureBorders = {
      top: true,
      bottom: true,
      left: true,
      right: true,
    } as const;

    for (const trimesterIndex of [1, 2, 3] as const) {
      drawCell(
        layout.colPos[trimesterIndex] + layout.shiftX,
        yPosBlocs,
        layout.colWidths[trimesterIndex],
        maximaHeight,
        "",
        false,
        "center",
        blank,
        signatureBorders,
      );
    }

    const finalColIndex = PRIMARY_FINAL_COL_INDEX;
    drawCell(
      layout.colPos[finalColIndex] + layout.shiftX,
      yPosBlocs,
      layout.colWidths[finalColIndex],
      maximaHeight,
      "",
      false,
      "center",
      blank,
      signatureBorders,
    );

    return yPosBlocs + maximaHeight;
  }

  const isPercentage = subject.name === "POURCENTAGES";
  const specialRows = ["APPLICATIONS", "CONDUITE"];
  const isSpecial = specialRows.includes(subject.name);

  drawBranchesCell(drawCell, layout, yPosBlocs, maximaHeight, subject.name, "left");

  const cellValues = buildGenerauxCellValues(
    layout,
    autresByPeriod,
    subject.name,
    generalesMaxima,
    isPercentage,
  );

  for (const cell of layout.evalCells) {
    const valStr = cellValues[cell.key] ?? "";
    const valNum = Number.parseInt(valStr, 10) || 0;
    let fill: {
      text?: string;
      fill?: string;
      bold?: boolean;
      fontSize?: number;
      hatch?: "dashed";
    } = whiteFill;

    if (
      cell.kind === "max-per" ||
      cell.kind === "max-exam" ||
      cell.kind === "max-trim" ||
      cell.kind === "max-total"
    ) {
      // CONDUITE : tirets diagonaux serrés à la place du fond noir
      fill =
        subject.name === "CONDUITE"
          ? { text: "black", fill: "white", hatch: "dashed" }
          : { ...maximaBlack, bold: true };
    } else if (cell.kind === "period-score" && valStr) {
      const maxMap: Record<string, number> = {
        p1: generalesMaxima.p1,
        p2: generalesMaxima.p2,
        p3: generalesMaxima.p3,
        p4: generalesMaxima.p4,
        p5: generalesMaxima.p5,
        p6: generalesMaxima.p6,
      };
      fill = {
        text: getColor(valNum, isPercentage ? "percentage" : "score", maxMap[cell.periodKey ?? ""] ?? 0),
        fill: "white",
        ...PERIOD_SCORE_STYLE,
      };
    } else if (
      (cell.kind === "pts-exam" || cell.kind === "pts-trim" || cell.kind === "pts-total") &&
      valStr &&
      !isSpecial
    ) {
      const maxKey =
        cell.kind === "pts-trim"
          ? cell.trimesterIndex === 1
            ? "tt1"
            : cell.trimesterIndex === 2
              ? "tt2"
              : "tt3"
          : cell.kind === "pts-total"
            ? "tg"
            : cell.trimesterIndex === 1
              ? "tt1"
              : cell.trimesterIndex === 2
                ? "tt2"
                : "tt3";
      const maxMap: Record<string, number> = {
        tt1: generalesMaxima.tt1,
        tt2: generalesMaxima.tt2,
        tt3: generalesMaxima.tt3,
        tg: generalesMaxima.tg,
      };
      fill = {
        text: getColor(
          valNum,
          isPercentage ? "percentage" : "score",
          isPercentage ? 100 : maxMap[maxKey] ?? 0,
        ),
        fill: "white",
      };
    }

    drawCell(cell.x, yPosBlocs, cell.width, maximaHeight, valStr, false, "center", fill);
  }

  return yPosBlocs + maximaHeight;
}

export function buildGenerauxCellValues(
  layout: PrimaryBulletinLayout,
  autresByPeriod: Record<string, Record<string, Record<string, Record<string, unknown>>>>,
  rowKey: string,
  generalesMaxima: {
    p1: number;
    p2: number;
    exam1?: number;
    tt1: number;
    p3: number;
    p4: number;
    exam2?: number;
    tt2: number;
    p5: number;
    p6: number;
    exam3?: number;
    tt3: number;
    tg: number;
  },
  isPercentage = false,
): Partial<Record<string, string>> {
  const values: Partial<Record<string, string>> = {};
  const fillMaximaText = rowKey === "TOTAUX" || rowKey === "POURCENTAGES";

  for (const cell of layout.evalCells) {
    if (
      fillMaximaText &&
      (cell.kind === "max-per" ||
        cell.kind === "max-exam" ||
        cell.kind === "max-trim" ||
        cell.kind === "max-total")
    ) {
      if (isPercentage) {
        // Cases MAX noircies : pas de valeur affichée (seulement le fond noir)
        values[cell.key] = "";
        continue;
      }
      if (cell.kind === "max-per") {
        values[cell.key] = generalesMaxima.p1 ? String(generalesMaxima.p1) : "";
      } else if (cell.kind === "max-exam") {
        const exam =
          cell.maximaKey === "exam1"
            ? generalesMaxima.exam1
            : cell.maximaKey === "exam2"
              ? generalesMaxima.exam2
              : generalesMaxima.exam3;
        values[cell.key] = exam ? String(exam) : "";
      } else if (cell.kind === "max-trim") {
        const trim =
          cell.trimesterIndex === 1
            ? generalesMaxima.tt1
            : cell.trimesterIndex === 2
              ? generalesMaxima.tt2
              : generalesMaxima.tt3;
        values[cell.key] = trim ? String(trim) : "";
      } else if (cell.kind === "max-total") {
        values[cell.key] = generalesMaxima.tg ? String(generalesMaxima.tg) : "";
      }
      continue;
    }

    if (cell.kind === "period-score" && cell.periodKey) {
      const storageKey =
        cell.trimesterIndex === 1 ? "sem1" : cell.trimesterIndex === 2 ? "sem2" : "sem3";
      values[cell.key] = safeStrLocal(
        autresByPeriod[cell.periodKey]?.[rowKey]?.[storageKey]?.[cell.periodKey],
      );
    } else if (cell.kind === "pts-exam" && cell.periodKey) {
      const storageKey =
        cell.trimesterIndex === 1 ? "sem1" : cell.trimesterIndex === 2 ? "sem2" : "sem3";
      values[cell.key] = safeStrLocal(
        autresByPeriod[cell.periodKey]?.[rowKey]?.[storageKey]?.[cell.periodKey],
      );
    } else if (cell.kind === "pts-trim") {
      const examKey = cell.trimesterIndex === 1 ? "exam1" : cell.trimesterIndex === 2 ? "exam2" : "exam3";
      const storageKey =
        cell.trimesterIndex === 1 ? "sem1" : cell.trimesterIndex === 2 ? "sem2" : "sem3";
      const totalKey = cell.trimesterIndex === 1 ? "tt1" : cell.trimesterIndex === 2 ? "tt2" : "tt3";
      values[cell.key] = safeStrLocal(
        autresByPeriod[examKey]?.[rowKey]?.[storageKey]?.[totalKey],
      );
    } else if (cell.kind === "pts-total") {
      values[cell.key] = safeStrLocal(autresByPeriod["exam3"]?.[rowKey]?.sem3?.tg);
    }
  }

  return values;
}

function safeStrLocal(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value === 0 ? "" : String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

export function buildPrimaryMaximaValues(
  maxima: BulletinPeriodMaxima,
): PrimaryTrimesterMaximaValues {
  const yearMaxima = calculateBulletinYearMaxima(maxima, "PRIMAIRE");
  return {
    p1: maxima.p1,
    p2: maxima.p2,
    exam1: maxima.exam1,
    tt1: getBulletinGroupMaxima(yearMaxima, 1)?.total,
    p3: maxima.p3,
    p4: maxima.p4,
    exam2: maxima.exam2,
    tt2: getBulletinGroupMaxima(yearMaxima, 2)?.total,
    p5: maxima.p5,
    p6: maxima.p6,
    exam3: maxima.exam3,
    tt3: getBulletinGroupMaxima(yearMaxima, 3)?.total,
    maxAnnuel: yearMaxima.annualTotal,
  };
}

export type { PrimaryEvalCellLayout };
