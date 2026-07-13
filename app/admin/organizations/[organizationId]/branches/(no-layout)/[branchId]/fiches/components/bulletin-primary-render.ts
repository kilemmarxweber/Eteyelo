import type { ManagedBranchType } from "@/lib/academic-structure";
import {
  canShowGroupTotal,
  computeGroupTotal,
  type Subject,
} from "@/lib/types";

import {
  PRIMARY_TG_COL_INDEX,
  type PrimaryBulletinLayout,
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
    | { text?: string; fill?: string },
  borders?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  },
) => void;

type GetColorFn = (value: number, type: string, max: number) => string;

function drawPrimaryTrailingColumns(
  drawCell: DrawCellFn,
  layout: PrimaryBulletinLayout,
  yPosBlocs: number,
  maximaHeight: number,
  tgValue: string,
  tgColor: string | { text?: string; fill?: string },
) {
  const { colPos, shiftX, colWidths } = layout;

  drawCell(
    colPos[PRIMARY_TG_COL_INDEX] + shiftX,
    yPosBlocs,
    colWidths[PRIMARY_TG_COL_INDEX],
    maximaHeight,
    tgValue,
    false,
    "center",
    typeof tgColor === "string" ? { text: tgColor, fill: "white" } : tgColor,
  );
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
  maximaTG: number,
) {
  const { colPos, shiftX, colWidths, trim1, trim2, trim3 } = layout;

  drawCell(
    colPos[0] + shiftX,
    yPosBlocs,
    colWidths[0],
    maximaHeight,
    subject.name.toUpperCase(),
    false,
    "left",
  );

  const getVal = (key: string, val: number) =>
    activePeriodKeys.includes(key) && val !== 0 ? String(val) : "";

  const trimesters = [
    {
      colIndex: 1,
      trim: trim1,
      storage: subject.sem1,
      periods: [
        { key: "p1", val: subject.sem1.p1, max: subject.maxima?.p1 ?? subject.baseMaxScore },
        { key: "p2", val: subject.sem1.p2, max: subject.maxima?.p2 ?? subject.baseMaxScore },
      ],
      examKey: "exam1",
      examVal: subject.sem1.exam1,
      examMax: subject.maxima?.exam1 ?? subject.baseMaxScore * 2,
      groupOrder: 1,
      maximaTot: maximaTot1,
    },
    {
      colIndex: 2,
      trim: trim2,
      storage: subject.sem2,
      periods: [
        { key: "p3", val: subject.sem2.p3, max: subject.maxima?.p3 ?? subject.baseMaxScore },
        { key: "p4", val: subject.sem2.p4, max: subject.maxima?.p4 ?? subject.baseMaxScore },
      ],
      examKey: "exam2",
      examVal: subject.sem2.exam2,
      examMax: subject.maxima?.exam2 ?? subject.baseMaxScore * 2,
      groupOrder: 2,
      maximaTot: maximaTot2,
    },
    {
      colIndex: 3,
      trim: trim3,
      storage: subject.sem3 ?? {},
      periods: [
        { key: "p5", val: subject.sem3?.p5 ?? 0, max: subject.maxima?.p5 ?? subject.baseMaxScore },
        { key: "p6", val: subject.sem3?.p6 ?? 0, max: subject.maxima?.p6 ?? subject.baseMaxScore },
      ],
      examKey: "exam3",
      examVal: subject.sem3?.exam3 ?? 0,
      examMax: subject.maxima?.exam3 ?? subject.baseMaxScore * 2,
      groupOrder: 3,
      maximaTot: maximaTot3,
    },
  ] as const;

  for (const trimester of trimesters) {
    trimester.periods.forEach((period, index) => {
      drawCell(
        colPos[trimester.colIndex] +
          shiftX +
          trimester.trim.periodWidths.slice(0, index).reduce((a, b) => a + b, 0),
        yPosBlocs,
        trimester.trim.periodWidths[index],
        maximaHeight,
        getVal(period.key, period.val ?? 0),
        false,
        "center",
        {
          text: getColor(period.val ?? 0, "score", period.max),
          fill: "white",
        },
      );
    });

    drawCell(
      trimester.trim.totX,
      yPosBlocs,
      trimester.trim.subWidths[1],
      maximaHeight,
      getVal(trimester.examKey, trimester.examVal ?? 0),
      false,
      "center",
      {
        text: getColor(trimester.examVal ?? 0, "score", trimester.examMax),
        fill: "white",
      },
    );

    const groupTotal = computeGroupTotal(
      subject,
      trimester.groupOrder,
      activePeriodKeys,
      branchType,
    );

    drawCell(
      trimester.trim.examX,
      yPosBlocs,
      trimester.trim.subWidths[2],
      maximaHeight,
      canShowGroupTotal(trimester.groupOrder, activePeriodKeys, branchType) &&
        groupTotal !== 0
        ? String(groupTotal)
        : "",
      false,
      "center",
      {
        text: getColor(groupTotal, "score", trimester.maximaTot),
        fill: "white",
      },
    );
  }

  const tt1 = computeGroupTotal(subject, 1, activePeriodKeys, branchType);
  const tt2 = computeGroupTotal(subject, 2, activePeriodKeys, branchType);
  const tt3 = computeGroupTotal(subject, 3, activePeriodKeys, branchType);
  const canTg =
    canShowGroupTotal(1, activePeriodKeys, branchType) &&
    canShowGroupTotal(2, activePeriodKeys, branchType) &&
    canShowGroupTotal(3, activePeriodKeys, branchType);
  const tgTotalScore =
    tt1 > 0 && tt2 > 0 && tt3 > 0 && canTg ? tt1 + tt2 + tt3 : 0;

  drawPrimaryTrailingColumns(
    drawCell,
    layout,
    yPosBlocs,
    maximaHeight,
    tgTotalScore !== 0 ? String(tgTotalScore) : "",
    getColor(tgTotalScore, "score", maximaTG),
  );

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
    tt1: number;
    p3: number;
    p4: number;
    tt2: number;
    p5: number;
    p6: number;
    tt3: number;
    tg: number;
  },
  getColor: GetColorFn,
  safeStr: (val: unknown) => string,
  isGeneraux?: boolean,
) {
  const { colPos, shiftX, colWidths, trim1, trim2, trim3 } = layout;
  const specialRows = ["APPLICATIONS", "CONDUITE"];
  const blank = { text: "white", fill: "white" } as const;
  const blackFill = { text: "black", fill: "black" } as const;
  const whiteFill = { text: "black", fill: "white" } as const;

  if (isGeneraux && specialRows.includes(subject.name)) {
    const key = subject.name;

    drawCell(colPos[0] + shiftX, yPosBlocs, colWidths[0], maximaHeight, key, false, "left");

    const groups = [
      { colIndex: 1, trim: trim1, periodKeys: ["p1", "p2"], storageKey: "sem1", examKey: "exam1", totalKey: "tt1" },
      { colIndex: 2, trim: trim2, periodKeys: ["p3", "p4"], storageKey: "sem2", examKey: "exam2", totalKey: "tt2" },
      { colIndex: 3, trim: trim3, periodKeys: ["p5", "p6"], storageKey: "sem3", examKey: "exam3", totalKey: "tt3" },
    ] as const;

    for (const group of groups) {
      group.periodKeys.forEach((periodKey, index) => {
        drawCell(
          colPos[group.colIndex] +
            shiftX +
            group.trim.periodWidths.slice(0, index).reduce((a, b) => a + b, 0),
          yPosBlocs,
          group.trim.periodWidths[index],
          maximaHeight,
          safeStr(autresByPeriod[periodKey]?.[key]?.[group.storageKey]?.[periodKey]),
          false,
          "center",
        );
      });

      drawCell(
        group.trim.totX,
        yPosBlocs,
        group.trim.subWidths[1],
        maximaHeight,
        "",
        false,
        "center",
        blackFill,
      );

      drawCell(
        group.trim.examX,
        yPosBlocs,
        group.trim.subWidths[2],
        maximaHeight,
        safeStr(autresByPeriod[group.examKey]?.[key]?.[group.storageKey]?.[group.totalKey]),
        false,
        "center",
        blackFill,
      );
    }

    drawPrimaryTrailingColumns(
      drawCell,
      layout,
      yPosBlocs,
      maximaHeight,
      safeStr(autresByPeriod["exam3"]?.[key]?.sem3?.tg),
      blackFill,
    );

    return yPosBlocs + maximaHeight;
  }

  if (isGeneraux && subject.name === "SIGNATURE PARENTS") {
    drawCell(
      colPos[0] + shiftX,
      yPosBlocs,
      colWidths[0],
      maximaHeight,
      subject.name,
      false,
      "left",
    );

    const borders = { top: true, bottom: true, left: false, right: false };
    const groups = [trim1, trim2, trim3];
    const colIndexes = [1, 2, 3];

    groups.forEach((trim, groupIndex) => {
      const baseX = colPos[colIndexes[groupIndex]] + shiftX;
      drawCell(baseX, yPosBlocs, trim.periodWidths[0], maximaHeight, "", false, "center", blank, {
        ...borders,
        left: groupIndex === 0,
      });
      drawCell(
        baseX + trim.periodWidths[0],
        yPosBlocs,
        trim.periodWidths[1],
        maximaHeight,
        "",
        false,
        "center",
        blank,
        borders,
      );
      drawCell(trim.totX, yPosBlocs, trim.subWidths[1], maximaHeight, "", false, "center", blank, borders);
      drawCell(trim.examX, yPosBlocs, trim.subWidths[2], maximaHeight, "", false, "center", blank, borders);
    });

    drawPrimaryTrailingColumns(drawCell, layout, yPosBlocs, maximaHeight, "", blank);
    return yPosBlocs + maximaHeight;
  }

  if (isGeneraux && subject.name === "PLACE/NOMBRE D'ELEVES") {
    drawCell(
      colPos[0] + shiftX,
      yPosBlocs,
      colWidths[0],
      maximaHeight,
      subject.name,
      false,
      "left",
    );

    const key = subject.name;
    const groups = [
      { colIndex: 1, trim: trim1, periodKeys: ["p1", "p2"], storageKey: "sem1", examKey: "exam1", totalKey: "tt1" },
      { colIndex: 2, trim: trim2, periodKeys: ["p3", "p4"], storageKey: "sem2", examKey: "exam2", totalKey: "tt2" },
      { colIndex: 3, trim: trim3, periodKeys: ["p5", "p6"], storageKey: "sem3", examKey: "exam3", totalKey: "tt3" },
    ] as const;

    for (const group of groups) {
      group.periodKeys.forEach((periodKey, index) => {
        drawCell(
          colPos[group.colIndex] +
            shiftX +
            group.trim.periodWidths.slice(0, index).reduce((a, b) => a + b, 0),
          yPosBlocs,
          group.trim.periodWidths[index],
          maximaHeight,
          safeStr(autresByPeriod[periodKey]?.[key]?.[group.storageKey]?.[periodKey]),
          false,
          "center",
        );
      });

      const examStr = safeStr(
        autresByPeriod[group.examKey]?.[key]?.[group.storageKey]?.[group.examKey],
      );
      drawCell(
        group.trim.totX,
        yPosBlocs,
        group.trim.subWidths[1],
        maximaHeight,
        examStr,
        false,
        "center",
        blackFill,
      );

      const totalStr = safeStr(
        autresByPeriod[group.examKey]?.[key]?.[group.storageKey]?.[group.totalKey],
      );
      drawCell(
        group.trim.examX,
        yPosBlocs,
        group.trim.subWidths[2],
        maximaHeight,
        totalStr,
        false,
        "center",
        whiteFill,
      );
    }

    const tgStr = safeStr(autresByPeriod["exam3"]?.[key]?.sem3?.tg);
    drawPrimaryTrailingColumns(drawCell, layout, yPosBlocs, maximaHeight, tgStr, whiteFill);
    return yPosBlocs + maximaHeight;
  }

  const isPercentage = isGeneraux && subject.name === "POURCENTAGES";
  const dataKey = isPercentage ? "POURCENTAGES" : "TOTAUX";

  drawCell(
    colPos[0] + shiftX,
    yPosBlocs,
    colWidths[0],
    maximaHeight,
    subject.name,
    false,
    "left",
  );

  const periodMaxima = [
    generalesMaxima.p1,
    generalesMaxima.p2,
    generalesMaxima.p3,
    generalesMaxima.p4,
    generalesMaxima.p5,
    generalesMaxima.p6,
  ];
  const periodKeys = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;
  const groups = [
    { colIndex: 1, trim: trim1, periodIndexes: [0, 1], storageKey: "sem1", examKey: "exam1", totalKey: "tt1" },
    { colIndex: 2, trim: trim2, periodIndexes: [2, 3], storageKey: "sem2", examKey: "exam2", totalKey: "tt2" },
    { colIndex: 3, trim: trim3, periodIndexes: [4, 5], storageKey: "sem3", examKey: "exam3", totalKey: "tt3" },
  ] as const;

  for (const group of groups) {
    group.periodIndexes.forEach((periodIndex, localIndex) => {
      const periodKey = periodKeys[periodIndex];
      const valStr = safeStr(
        autresByPeriod[periodKey]?.[dataKey]?.[group.storageKey]?.[periodKey],
      );
      const valNum = Number.parseInt(valStr, 10) || 0;

      drawCell(
        colPos[group.colIndex] +
          shiftX +
          group.trim.periodWidths.slice(0, localIndex).reduce((a, b) => a + b, 0),
        yPosBlocs,
        group.trim.periodWidths[localIndex],
        maximaHeight,
        valStr,
        false,
        "center",
        {
          text: getColor(
            valNum,
            isPercentage ? "percentage" : "score",
            periodMaxima[periodIndex],
          ),
          fill: "white",
        },
      );
    });

    const examStr = safeStr(
      autresByPeriod[group.examKey]?.[dataKey]?.[group.storageKey]?.[group.examKey],
    );
    drawCell(
      group.trim.totX,
      yPosBlocs,
      group.trim.subWidths[1],
      maximaHeight,
      examStr,
      false,
      "center",
      blackFill,
    );

    const totalStr = safeStr(
      autresByPeriod[group.examKey]?.[dataKey]?.[group.storageKey]?.[group.totalKey],
    );
    drawCell(
      group.trim.examX,
      yPosBlocs,
      group.trim.subWidths[2],
      maximaHeight,
      totalStr,
      false,
      "center",
      whiteFill,
    );
  }

  const tgStr = safeStr(autresByPeriod["exam3"]?.[dataKey]?.sem3?.tg);
  const tgNum = Number.parseInt(tgStr, 10) || 0;

  drawPrimaryTrailingColumns(
    drawCell,
    layout,
    yPosBlocs,
    maximaHeight,
    tgStr,
    {
      text: getColor(
        tgNum,
        isPercentage ? "percentage" : "score",
        generalesMaxima.tg,
      ),
      fill: "white",
    },
  );

  return yPosBlocs + maximaHeight;
}
