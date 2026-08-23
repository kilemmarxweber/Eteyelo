import type { ExamExportMeta } from "@/lib/exam-export-meta";

export type FinalisteExcelRow = {
  numero: number;
  matricule: string;
  fullName: string;
  placeOfBirth: string;
  dateOfBirth: string;
  sexe: string;
  e13: string;
  e80: string;
  fatherName: string;
  motherName: string;
  nationalite: string;
  avenue: string;
  numeroAdresse: string;
  quartier: string;
  commune: string;
  ville: string;
  annee: string;
  ecole: string;
};

export type FinalisteExcelPayload = {
  meta: ExamExportMeta;
  session: string;
  classLabel: string;
  rows: FinalisteExcelRow[];
};

const HEADERS = [
  "N°",
  "MATRICULE",
  "NOM, POST-NOM ET PRENOM",
  "LIEU DE NAISSANCE",
  "DATE DE NAISSANCE",
  "SEXE",
  "E13",
  "E80",
  "NOM DU PERE",
  "NOM DE LA MERE",
  "NATIONALITE",
  "AVENUE/RUE/VILLAGE",
  "NUMERO",
  "QUARTIER/CITE/SECTEUR",
  "COMMUNE/TERRITOIRE",
  "VILLE",
  "ANNEE",
  "ECOLE",
] as const;

const META_ROW_COUNT = 7;
const TABLE_HEADER_ROW = META_ROW_COUNT + 1;

const FONT_LABEL = {
  name: "Arial",
  size: 10,
  color: { argb: "FF000000" },
} as const;

const FONT_VALUE_BLUE = {
  name: "Arial",
  size: 10,
  color: { argb: "FF0000FF" },
} as const;

const FONT_VALUE_RED = {
  name: "Arial",
  size: 10,
  color: { argb: "FFFF0000" },
} as const;

const FONT_VALUE_BLUE_BOLD = {
  name: "Arial",
  size: 10,
  bold: true,
  color: { argb: "FF0000FF" },
} as const;

type MetaRowSpec = {
  label: string;
  value: string;
  valueColor?: "blue" | "red";
  valueBold?: boolean;
  code?: string;
};

function displayOrDash(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || "—";
}

function writeMetaRow(
  sheet: import("exceljs").Worksheet,
  rowIndex: number,
  spec: MetaRowSpec,
) {
  const labelCell = sheet.getCell(`A${rowIndex}`);
  labelCell.value = `${spec.label}:`;
  labelCell.font = { ...FONT_LABEL };

  const valueCell = sheet.getCell(`B${rowIndex}`);
  valueCell.value = spec.value;
  valueCell.font =
    spec.valueBold === true
      ? { ...FONT_VALUE_BLUE_BOLD }
      : spec.valueColor === "red"
        ? { ...FONT_VALUE_RED }
        : { ...FONT_VALUE_BLUE };

  if (spec.code !== undefined) {
    const codeLabelCell = sheet.getCell(`D${rowIndex}`);
    codeLabelCell.value = "CODE:";
    codeLabelCell.font = { ...FONT_LABEL };

    const codeCell = sheet.getCell(`F${rowIndex}`);
    codeCell.value = displayOrDash(spec.code);
    codeCell.font = { ...FONT_VALUE_BLUE };
    codeCell.alignment = { horizontal: "right" };
    codeCell.numFmt = "@";
  } else if (spec.label === "ORDRE") {
    valueCell.numFmt = "@";
    valueCell.alignment = { horizontal: "left" };
  }
}

function buildMetaRows(
  meta: ExamExportMeta,
  session: string,
): MetaRowSpec[] {
  return [
    {
      label: "PROVINCE",
      value: displayOrDash(meta.province),
      valueColor: "red",
      code: meta.provinceCode,
    },
    {
      label: "CENTRE",
      value: displayOrDash(meta.centre),
      code: meta.centreCode,
    },
    {
      label: "ETABLISSEMENT",
      value: displayOrDash(meta.etablissement),
      code: meta.etablissementCode,
    },
    {
      label: "OPTION",
      value: displayOrDash(meta.option),
      code: meta.optionCode,
    },
    {
      label: "ORDRE",
      value: displayOrDash(meta.ordre),
    },
    {
      label: "GESTION",
      value: displayOrDash(meta.gestion),
      valueBold: true,
      code: meta.gestionCode,
    },
    {
      label: "SESSION",
      value: displayOrDash(session),
      valueColor: "red",
    },
  ];
}

export async function downloadFinalistesExcel(payload: FinalisteExcelPayload) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eteyelo";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Finalistes", {
    views: [{ state: "frozen", ySplit: TABLE_HEADER_ROW }],
  });

  buildMetaRows(payload.meta, payload.session).forEach((spec, index) => {
    writeMetaRow(sheet, index + 1, spec);
  });

  const headerRow = sheet.getRow(TABLE_HEADER_ROW);
  HEADERS.forEach((title, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = title;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: "center", wrapText: true, vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8EEF7" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 28;

  payload.rows.forEach((row) => {
    const excelRow = sheet.addRow([
      String(row.numero).padStart(3, "0"),
      row.matricule,
      row.fullName,
      row.placeOfBirth,
      row.dateOfBirth,
      row.sexe,
      row.e13,
      row.e80,
      row.fatherName,
      row.motherName,
      row.nationalite,
      row.avenue,
      row.numeroAdresse,
      row.quartier,
      row.commune,
      row.ville,
      row.annee,
      row.ecole,
    ]);
    excelRow.eachCell((cell) => {
      cell.font = { size: 9 };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 42;
  sheet.getColumn(3).width = 4;
  sheet.getColumn(4).width = 10;
  sheet.getColumn(5).width = 4;
  sheet.getColumn(6).width = 14;

  const dataWidths = [6, 14, 32, 16, 16, 8, 12, 12, 24, 24, 14, 18, 10, 18, 16, 14, 10, 14];
  dataWidths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = Math.max(
      sheet.getColumn(index + 1).width ?? 0,
      width,
    );
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `liste-finalistes-6e-${payload.session}-${date}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
