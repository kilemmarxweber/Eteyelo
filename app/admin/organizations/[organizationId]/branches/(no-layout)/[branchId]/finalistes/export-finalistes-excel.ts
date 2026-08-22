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

function metaLine(
  label: string,
  value: string | undefined,
  code: string | undefined,
) {
  const parts = [value?.trim()].filter(Boolean);
  if (code?.trim()) parts.push(`(CODE: ${code.trim()})`);
  return `${label}: ${parts.join(" ") || "—"}`;
}

export async function downloadFinalistesExcel(payload: FinalisteExcelPayload) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eteyelo";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Finalistes", {
    views: [{ state: "frozen", ySplit: 9 }],
  });

  sheet.mergeCells("A1:R1");
  sheet.getCell("A1").value = "LISTE DES FINALISTES — PRIMAIRE 6";
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  const { meta } = payload;
  const headerLines = [
    metaLine("PROVINCE", meta.province, meta.provinceCode),
    metaLine("CENTRE", meta.centre, meta.centreCode),
    metaLine("ETABLISSEMENT", meta.etablissement, meta.etablissementCode),
    metaLine("OPTION", meta.option, meta.optionCode),
    `ORDRE: ${meta.ordre?.trim() || "—"}`,
    metaLine("GESTION", meta.gestion, meta.gestionCode),
    `SESSION: ${payload.session}`,
    `CLASSE: ${payload.classLabel}`,
  ];

  headerLines.forEach((line, index) => {
    const rowIndex = index + 2;
    sheet.mergeCells(`A${rowIndex}:R${rowIndex}`);
    sheet.getCell(`A${rowIndex}`).value = line;
    sheet.getCell(`A${rowIndex}`).font = { size: 10 };
  });

  const headerRow = sheet.getRow(10);
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

  const widths = [6, 14, 32, 16, 16, 8, 12, 12, 24, 24, 14, 18, 10, 18, 16, 14, 10, 14];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
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
