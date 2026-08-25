import type ExcelJS from "exceljs";

export type CotationExcelRow = {
  nom: string;
  scores: Array<number | null>;
  percentage: number;
  place: number | "";
};

export type CotationExcelPayload = {
  schoolName: string;
  branchName: string;
  classLabel: string;
  schoolYearLabel: string;
  schoolYearValue: string;
  period: string;
  subjects: string[];
  rows: CotationExcelRow[];
};

const BRAND = {
  primary: "1E40AF",
  headerBg: "1E3A8A",
  primarySoft: "DBEAFE",
  altRow: "F8FAFC",
  averageBg: "DBEAFE",
  border: "CBD5E1",
  muted: "64748B",
  fail: "B91C1C",
} as const;

const THIN_BORDER: ExcelJS.Borders = {
  top: { style: "thin", color: { argb: `FF${BRAND.border}` } },
  left: { style: "thin", color: { argb: `FF${BRAND.border}` } },
  bottom: { style: "thin", color: { argb: `FF${BRAND.border}` } },
  right: { style: "thin", color: { argb: `FF${BRAND.border}` } },
};

const TITLE_ROW = 1;
const META_ROW = 2;
const GENERATED_ROW = 3;
const HEADER_ROW = 5;
const DATA_START_ROW = 6;

function safeFilePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "export";
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = THIN_BORDER;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function downloadCotationExcel(payload: CotationExcelPayload) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eteyelo";
  workbook.created = new Date();

  const subjectCount = payload.subjects.length;
  const columnCount = 2 + subjectCount + 2;
  const sheet = workbook.addWorksheet("Résultats de cotation", {
    views: [
      {
        state: "frozen",
        xSplit: 2,
        ySplit: HEADER_ROW,
        showGridLines: false,
      },
    ],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
    },
    headerFooter: {
      oddHeader: `&L${payload.branchName || payload.schoolName}&CRésultats de cotation&R${payload.classLabel}`,
      oddFooter: "&L&D&CPage &P / &N",
    },
  });

  sheet.mergeCells(TITLE_ROW, 1, TITLE_ROW, columnCount);
  const titleCell = sheet.getCell(TITLE_ROW, 1);
  titleCell.value = "Résultats de cotation";
  titleCell.font = {
    name: "Calibri",
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${BRAND.headerBg}` },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(TITLE_ROW).height = 30;

  sheet.mergeCells(META_ROW, 1, META_ROW, columnCount);
  const metaCell = sheet.getCell(META_ROW, 1);
  metaCell.value = [
    payload.branchName || payload.schoolName,
    payload.classLabel ? `Classe ${payload.classLabel}` : "",
    payload.schoolYearValue
      ? `${payload.schoolYearLabel} ${payload.schoolYearValue}`
      : "",
    payload.period ? `Période ${payload.period}` : "",
    `${payload.rows.length} élève${payload.rows.length > 1 ? "s" : ""}`,
    `${subjectCount} matière${subjectCount > 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  metaCell.font = {
    name: "Calibri",
    size: 10,
    color: { argb: `FF${BRAND.primary}` },
  };
  metaCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${BRAND.primarySoft}` },
  };
  metaCell.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(META_ROW).height = 20;

  sheet.mergeCells(GENERATED_ROW, 1, GENERATED_ROW, columnCount);
  const generatedCell = sheet.getCell(GENERATED_ROW, 1);
  generatedCell.value = `Généré le ${new Date().toLocaleString("fr-FR")}`;
  generatedCell.font = {
    name: "Calibri",
    size: 9,
    italic: true,
    color: { argb: `FF${BRAND.muted}` },
  };
  generatedCell.alignment = { indent: 1 };

  const headers = ["N°", "Nom", ...payload.subjects, "Pourcentage", "Place"];
  const headerRow = sheet.getRow(HEADER_ROW);
  headerRow.height = 96;

  headers.forEach((title, index) => {
    const cell = headerRow.getCell(index + 1);
    const isSubject = index >= 2 && index < 2 + subjectCount;
    cell.value = title;
    cell.font = {
      name: "Calibri",
      bold: true,
      size: isSubject ? 9 : 10,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${BRAND.headerBg}` },
    };
    cell.alignment = isSubject
      ? {
          textRotation: 90,
          vertical: "bottom",
          horizontal: "center",
          wrapText: true,
        }
      : {
          vertical: "middle",
          horizontal: index === 1 ? "left" : "center",
          wrapText: true,
        };
    applyBorder(cell);
  });

  payload.rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(DATA_START_ROW + rowIndex);
    const values: Array<string | number> = [
      rowIndex + 1,
      row.nom,
      ...row.scores.map((score) => (score === null ? "—" : score)),
      Number(row.percentage.toFixed(1)),
      row.place === "" ? "—" : row.place,
    ];

    excelRow.height = 18;
    values.forEach((value, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      cell.value = value;
      cell.font = {
        name: "Calibri",
        size: 10,
        bold: colIndex === 1,
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colIndex === 1 ? "left" : "center",
      };
      if (rowIndex % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${BRAND.altRow}` },
        };
      }
      applyBorder(cell);

      if (colIndex >= 2 && colIndex < 2 + subjectCount && typeof value === "number") {
        cell.numFmt = "0.##";
      }

      if (colIndex === 2 + subjectCount) {
        cell.numFmt = "0.0";
        if (row.percentage < 50) {
          cell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: `FF${BRAND.fail}` },
          };
        }
      }
    });
  });

  const averageScores = payload.subjects.map((_, subjectIndex) =>
    average(
      payload.rows
        .map((row) => row.scores[subjectIndex])
        .filter((score): score is number => score !== null),
    ),
  );
  const averagePct = average(payload.rows.map((row) => row.percentage));
  const averageRowIndex = DATA_START_ROW + payload.rows.length;
  const averageRow = sheet.getRow(averageRowIndex);
  averageRow.height = 20;

  const averageValues: Array<string | number> = [
    "",
    "Moyenne de classe",
    ...averageScores.map((value) =>
      value === null ? "—" : Number(value.toFixed(1)),
    ),
    averagePct === null ? "—" : Number(averagePct.toFixed(1)),
    "",
  ];

  averageValues.forEach((value, colIndex) => {
    const cell = averageRow.getCell(colIndex + 1);
    cell.value = value;
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: `FF${BRAND.primary}` },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${BRAND.averageBg}` },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: colIndex === 1 ? "left" : "center",
    };
    applyBorder(cell);
    if (typeof value === "number") {
      cell.numFmt = "0.0";
    }
  });

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 32;
  payload.subjects.forEach((_, index) => {
    sheet.getColumn(3 + index).width = 5.5;
  });
  sheet.getColumn(3 + subjectCount).width = 12;
  sheet.getColumn(4 + subjectCount).width = 8;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resultats-cotation-${safeFilePart(payload.classLabel)}-${safeFilePart(payload.period)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
