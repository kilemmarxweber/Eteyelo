import type ExcelJS from "exceljs";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  documentChrome,
  formatDocumentDateTime,
  withDocumentLocale,
} from "@/lib/reports/document-locale";
import type { SchoolReportContext } from "@/lib/reports/types";
import type { IStudent } from "@/src/interfaces/Student";
import {
  buildStudentsReportTableModel,
  type StudentReportOptions,
} from "./export-students-pdf";

const THIN: ExcelJS.Borders = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
  diagonal: {},
};

const LOGO_SIZE_PX = 64;
/** Colonne à partir de laquelle l’identité / titre commence (après le logo). */
const TEXT_START_COL = 2;

function fillArgb(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function downloadWorkbookBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function logoExtension(
  dataUrl: string,
): "png" | "jpeg" | "gif" {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
    return "jpeg";
  }
  if (dataUrl.startsWith("data:image/gif")) return "gif";
  return "png";
}

async function addLogoImage(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  logoUrl: string | null | undefined,
) {
  if (!logoUrl?.trim()) return false;
  const dataUrl = await imageUrlToDataUrl(logoUrl);
  if (!dataUrl) return false;
  try {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageId = workbook.addImage({
      base64,
      extension: logoExtension(dataUrl),
    });
    sheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: LOGO_SIZE_PX, height: LOGO_SIZE_PX },
      editAs: "oneCell",
    });
    return true;
  } catch {
    return false;
  }
}

export async function exportStudentsReportExcel(
  students: IStudent[],
  context: SchoolReportContext,
  options: StudentReportOptions,
) {
  const ExcelJS = (await import("exceljs")).default;
  const { labels } = options;
  const localizedContext = withDocumentLocale(context, labels.locale);
  const chrome = documentChrome(localizedContext.locale);
  const model = buildStudentsReportTableModel(students, options);
  const colCount = Math.max(model.head.length, 1);
  const textEndCol = Math.max(colCount, TEXT_START_COL);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eteyelo";
  workbook.created = new Date();

  const sheetName =
    model.title.length > 28 ? model.title.slice(0, 28) : model.title;
  const sheet = workbook.addWorksheet(sheetName || "Liste", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const hasLogo = await addLogoImage(
    workbook,
    sheet,
    localizedContext.logoUrl,
  );

  // Espace logo à gauche (comme le PDF) ; identité à droite.
  sheet.getColumn(1).width = hasLogo ? 12 : 6;
  for (let row = 1; row <= 4; row += 1) {
    sheet.getRow(row).height = hasLogo ? 18 : 16;
  }

  sheet.mergeCells(1, TEXT_START_COL, 1, textEndCol);
  const schoolCell = sheet.getCell(1, TEXT_START_COL);
  schoolCell.value = localizedContext.schoolName || chrome.establishment;
  schoolCell.font = {
    name: "Calibri",
    size: 14,
    bold: true,
    color: { argb: "FF0F172A" },
  };
  schoolCell.alignment = { vertical: "middle" };

  if (localizedContext.branchName) {
    sheet.mergeCells(2, TEXT_START_COL, 2, textEndCol);
    const branchCell = sheet.getCell(2, TEXT_START_COL);
    branchCell.value = localizedContext.branchName;
    branchCell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FF334155" },
    };
    branchCell.alignment = { vertical: "middle" };
  }

  sheet.mergeCells(3, TEXT_START_COL, 3, textEndCol);
  const titleCell = sheet.getCell(3, TEXT_START_COL);
  titleCell.value = model.title;
  titleCell.font = {
    name: "Calibri",
    size: 13,
    bold: true,
    color: { argb: "FF1E40AF" },
  };
  titleCell.alignment = { vertical: "middle" };

  const metaParts = [
    ...model.filterLabels,
    labels.studentCount.replace(
      "{count}",
      String(model.sortedStudents.length),
    ),
    localizedContext.generatedAt
      ? `${chrome.generatedAt} ${formatDocumentDateTime(
          localizedContext.generatedAt,
          localizedContext.locale,
        )}`
      : "",
  ].filter(Boolean);

  sheet.mergeCells(4, TEXT_START_COL, 4, textEndCol);
  const metaCell = sheet.getCell(4, TEXT_START_COL);
  metaCell.value = metaParts.join("  ·  ");
  metaCell.font = {
    name: "Calibri",
    size: 9,
    color: { argb: "FF64748B" },
  };
  metaCell.alignment = { vertical: "middle", wrapText: true };

  const headerRowIndex = 6;
  model.head.forEach((label, index) => {
    const cell = sheet.getCell(headerRowIndex, index + 1);
    cell.value = label;
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = fillArgb("FF1E40AF");
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = THIN;
  });
  sheet.getRow(headerRowIndex).height = 22;
  sheet.views = [
    { showGridLines: false, state: "frozen", ySplit: headerRowIndex },
  ];

  model.body.forEach((row, rowOffset) => {
    const excelRow = headerRowIndex + 1 + rowOffset;
    const isAlt = rowOffset % 2 === 1;
    row.forEach((value, colIndex) => {
      const cell = sheet.getCell(excelRow, colIndex + 1);
      cell.value = value;
      cell.font = {
        name: "Calibri",
        size: 10,
        color: { argb: "FF1E293B" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal:
          colIndex === 0 || colIndex === 5 || colIndex === 6
            ? "center"
            : "left",
        wrapText: true,
      };
      cell.border = THIN;
      if (isAlt) cell.fill = fillArgb("FFF8FAFC");
    });
  });

  const widths = model.head.map((label, index) => {
    if (index === 0) return hasLogo ? 12 : 6;
    if (index === 5 || index === 6) return 8;
    if (label === labels.colMatricule) return 16;
    if (label === labels.colClass) return 22;
    if (label === labels.colBirthPlace) return 20;
    return 14;
  });
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  if (hasLogo) {
    sheet.getColumn(1).width = Math.max(sheet.getColumn(1).width ?? 0, 12);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  downloadWorkbookBuffer(
    buffer as ArrayBuffer,
    `${model.fileBaseName}-${date}.xlsx`,
  );
}
