import type ExcelJS from "exceljs";
import { formatReportAmount } from "@/lib/reports/format-amount";
import {
  renderAreaChartPng,
  renderBarChartPng,
  renderDonutChartPng,
  renderRadialChartPng,
  REPORT_CHART_COLORS,
} from "@/lib/reports/chart-canvas";
import type { CurrencyCode } from "@/prisma/generated/prisma/enums";
import type { OverviewReport } from "@/lib/reports/org/overview";
import type {
  EffectifsPersonRow,
  EffectifsReport,
} from "@/lib/reports/org/effectifs";
import type { AttendanceReport } from "@/lib/reports/org/attendance";
import type { FinanceReport } from "@/lib/reports/org/finance";
import type { SatisfactionReport } from "@/lib/reports/org/satisfaction";
import type { ResultsReport } from "@/lib/reports/org/results";
import type { HiringReport } from "@/lib/reports/org/hiring";
import type { RegistrationReport } from "@/lib/reports/org/registrations";
import type { ReportMeta } from "@/lib/reports/org/meta";
import type { ReportTab } from "@/lib/reports/org/definitions";

export type RapportExcelPayload = {
  meta: ReportMeta;
  /** Onglet actif : `overview` = toutes les feuilles, sinon une seule. */
  tab?: ReportTab;
  overview: OverviewReport | null;
  effectifs: EffectifsReport | null;
  attendance: AttendanceReport | null;
  finance: FinanceReport | null;
  satisfaction: SatisfactionReport | null;
  results: ResultsReport | null;
  hiring: HiringReport | null;
  registrations: RegistrationReport | null;
  organizationName?: string;
};

type Workbook = ExcelJS.Workbook;
type Worksheet = ExcelJS.Worksheet;
type Fill = ExcelJS.Fill;

const BRAND = {
  primary: "1E40AF",
  primarySoft: "DBEAFE",
  headerBg: "1E3A8A",
  altRow: "EFF6FF",
  kpiBg: "F8FAFC",
  border: "CBD5E1",
  cumulBg: "DBEAFE",
  muted: "64748B",
};

const HEADER_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: `FF${BRAND.headerBg}` },
};
const ALT_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: `FF${BRAND.altRow}` },
};
const TITLE_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: `FF${BRAND.primary}` },
};
const KPI_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: `FF${BRAND.kpiBg}` },
};
const TOTAUX_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: `FF${BRAND.cumulBg}` },
};

function money(value: number, currency: CurrencyCode) {
  return formatReportAmount(value, currency);
}

function scopeLabel(meta: ReportMeta) {
  if (meta.scope === "all") return "Toutes les branches";
  const branch = meta.branches.find((b) => b.id === meta.selectedBranchId);
  return branch?.name ?? "Branche sélectionnée";
}

function yearLabel(meta: ReportMeta) {
  if (meta.schoolYearKey === "all") return "Toutes les années";
  return (
    meta.schoolYears.find((y) => y.key === meta.schoolYearKey)?.label ??
    meta.schoolYearKey
  );
}

function styleSheet(ws: Worksheet, columnCount: number) {
  ws.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];
  ws.pageSetup = {
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
  };
  ws.headerFooter = {
    oddHeader: "&LRapport organisation&R&D",
    oddFooter: "&L&A&CPage &P / &N",
  };
  ws.properties.defaultRowHeight = 18;
  for (let c = 1; c <= Math.max(columnCount, 9); c++) {
    const col = ws.getColumn(c);
    col.width = c === 1 ? 14 : c <= 5 ? 16 : 14;
  }
}

function writeBanner(
  ws: Worksheet,
  title: string,
  meta: ReportMeta,
  colSpan: number,
  organizationName?: string,
) {
  ws.mergeCells(1, 1, 1, colSpan);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = TITLE_FILL;
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, colSpan);
  const metaCell = ws.getCell(2, 1);
  metaCell.value = [
    organizationName,
    scopeLabel(meta),
    yearLabel(meta),
    meta.classeKey === "all"
      ? "Toutes les classes"
      : (meta.classes.find((c) => c.key === meta.classeKey)?.label ??
        meta.classeKey),
    `Devise ${meta.currency.baseCurrency}`,
    meta.currency.rateLabel,
  ]
    .filter(Boolean)
    .join("  ·  ");
  metaCell.font = { size: 10, color: { argb: `FF${BRAND.primary}` } };
  metaCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${BRAND.primarySoft}` },
  };
  ws.getRow(2).height = 20;

  ws.mergeCells(3, 1, 3, colSpan);
  ws.getCell(3, 1).value = `Généré le ${new Date().toLocaleString("fr-FR")}`;
  ws.getCell(3, 1).font = {
    size: 9,
    italic: true,
    color: { argb: `FF${BRAND.muted}` },
  };
}

function writeSectionTitle(
  ws: Worksheet,
  row: number,
  title: string,
  colSpan: number,
) {
  ws.mergeCells(row, 1, row, colSpan);
  const cell = ws.getCell(row, 1);
  cell.value = title;
  cell.font = { bold: true, size: 12, color: { argb: `FF${BRAND.primary}` } };
  cell.alignment = { vertical: "middle" };
  ws.getRow(row).height = 24;
  return row + 2; // blank spacer row after title → avoids overlap with charts
}

function writeKpis(
  ws: Worksheet,
  startRow: number,
  kpis: Array<{ label: string; value: string | number }>,
) {
  let row = startRow;
  const perRow = Math.min(4, kpis.length || 1);
  for (let i = 0; i < kpis.length; i += perRow) {
    const slice = kpis.slice(i, i + perRow);
    slice.forEach((kpi, idx) => {
      const col = idx * 2 + 1;
      ws.mergeCells(row, col, row, col + 1);
      const labelCell = ws.getCell(row, col);
      labelCell.value = kpi.label;
      labelCell.font = { size: 9, color: { argb: `FF${BRAND.muted}` } };
      labelCell.fill = KPI_FILL;
    });
    slice.forEach((kpi, idx) => {
      const col = idx * 2 + 1;
      ws.mergeCells(row + 1, col, row + 1, col + 1);
      const valueCell = ws.getCell(row + 1, col);
      valueCell.value = kpi.value;
      valueCell.font = { bold: true, size: 13, color: { argb: "FF0F172A" } };
      valueCell.fill = KPI_FILL;
      valueCell.alignment = { vertical: "middle" };
    });
    ws.getRow(row + 1).height = 24;
    row += 3;
  }
  return row + 1;
}

function writeTable(
  ws: Worksheet,
  startRow: number,
  headers: string[],
  rows: Array<Array<string | number>>,
  totalsRow?: Array<string | number>,
) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(startRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  ws.getRow(startRow).height = 20;

  const allRows = totalsRow ? [...rows, totalsRow] : rows;
  allRows.forEach((row, ri) => {
    const isTotal = Boolean(totalsRow) && ri === allRows.length - 1;
    row.forEach((value, ci) => {
      const cell = ws.getCell(startRow + 1 + ri, ci + 1);
      cell.value = value;
      cell.font = {
        size: 10,
        bold: isTotal,
        color: { argb: "FF0F172A" },
      };
      cell.alignment = { vertical: "middle" };
      if (isTotal) cell.fill = TOTAUX_FILL;
      else if (ri % 2 === 1) cell.fill = ALT_FILL;
    });
  });

  const endRow = startRow + allRows.length;
  if (rows.length > 30) {
    ws.getRow(endRow).addPageBreak();
  }
  return endRow + 2;
}

/** Réserve assez de lignes vides sous l'image pour éviter le chevauchement texte. */
async function addChartImage(
  workbook: Workbook,
  ws: Worksheet,
  dataUrl: string,
  row: number,
  widthPx: number,
  heightPx: number,
) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const imageId = workbook.addImage({ base64, extension: "png" });
  // Ligne spacer avant
  ws.getRow(row).height = 8;
  const imageRow = row + 1;
  ws.addImage(imageId, {
    tl: { col: 0, row: imageRow - 1 },
    ext: { width: widthPx, height: heightPx },
  });
  const rowsNeeded = Math.ceil(heightPx / 15) + 2;
  for (let i = 0; i < rowsNeeded; i++) {
    const r = ws.getRow(imageRow + i);
    r.height = 15;
    // Marqueur vide pour que les cellules ne soient pas réutilisées
    if (!r.getCell(1).value) r.getCell(1).value = "";
  }
  return imageRow + rowsNeeded + 2;
}

function personTableRows(list: EffectifsPersonRow[], withClass: boolean) {
  return list.map((p, i) => {
    const row: Array<string | number> = [
      i + 1,
      p.matricule,
      p.nom,
      p.postnom,
      p.prenom,
      p.sexe,
      p.statut,
      p.branche,
    ];
    if (withClass) row.push(p.classe ?? "—");
    return row;
  });
}

async function buildOverviewSheet(
  workbook: Workbook,
  payload: RapportExcelPayload,
) {
  const { meta, overview, organizationName } = payload;
  if (!overview) return;
  const currency = meta.currency.baseCurrency;
  const ws = workbook.addWorksheet("Vue d'ensemble", {
    properties: { tabColor: { argb: `FF${BRAND.primary}` } },
  });
  styleSheet(ws, 8);
  writeBanner(ws, "Vue d'ensemble", meta, 8, organizationName);

  let row = writeSectionTitle(ws, 5, "1. Détails — Comparaison inter-branches", 8);
  row = writeTable(
    ws,
    row,
    ["Branche", "Élèves", "Récoltes", "Satisfaction", "Réussite %"],
    overview.comparison.map((c) => [
      c.branchName,
      c.students,
      money(c.recoltes, currency),
      c.satisfaction,
      c.successRate,
    ]),
    [
      "TOTAUX",
      overview.students,
      money(overview.recoltes, currency),
      overview.satisfaction,
      overview.successRate,
    ],
  );

  row = writeSectionTitle(ws, row, "2. Totaux — Indicateurs", 8);
  row = writeKpis(ws, row, [
    { label: "Élèves", value: overview.students },
    { label: "Enseignants", value: overview.teachers },
    { label: "Parents", value: overview.parents },
    { label: "Personnel", value: overview.personnel },
    { label: "Présence %", value: `${overview.attendanceRate}%` },
    { label: "Récolté", value: money(overview.recoltes, currency) },
    { label: "Réussite %", value: `${overview.successRate}%` },
    { label: "Satisfaction", value: `${overview.satisfaction}/5` },
  ]);

  row = writeSectionTitle(ws, row, "3. Totaux — Graphique", 8);
  await addChartImage(
    workbook,
    ws,
    renderBarChartPng({
      categories: overview.comparison.map((c) => c.branchName),
      series: [
        { key: "eleves", label: "Élèves", color: REPORT_CHART_COLORS[0] },
        { key: "recoltes", label: "Récoltes", color: REPORT_CHART_COLORS[1] },
      ],
      data: overview.comparison.map((c) => ({
        eleves: c.students,
        recoltes: c.recoltes,
      })),
      width: 700,
      height: 260,
    }),
    row,
    700,
    260,
  );
}

async function buildEffectifsSheet(
  workbook: Workbook,
  payload: RapportExcelPayload,
) {
  const { meta, effectifs, organizationName } = payload;
  if (!effectifs) return;
  const ws = workbook.addWorksheet("Effectifs", {
    properties: { tabColor: { argb: "FF2563EB" } },
  });
  styleSheet(ws, 9);
  writeBanner(ws, "Effectifs — Totaux & détails", meta, 9, organizationName);

  let row = writeSectionTitle(ws, 5, "1. Totaux — Indicateurs", 9);
  row = writeKpis(ws, row, [
    { label: "Élèves", value: effectifs.students.total },
    { label: "Parents", value: effectifs.parents.total },
    { label: "Enseignants", value: effectifs.teachers.total },
    { label: "Personnel", value: effectifs.personnel.total },
  ]);

  row = writeSectionTitle(ws, row, "2. Totaux — Par classe", 9);
  row = writeTable(
    ws,
    row,
    ["Classe", "Total", "Garçons", "Filles"],
    effectifs.students.byClass.map((c) => [c.name, c.total, c.boys, c.girls]),
    [
      "TOTAUX",
      effectifs.students.byClass.reduce((s, c) => s + c.total, 0),
      effectifs.students.byClass.reduce((s, c) => s + c.boys, 0),
      effectifs.students.byClass.reduce((s, c) => s + c.girls, 0),
    ],
  );

  row = writeSectionTitle(ws, row, "3. Totaux — Par branche", 9);
  row = writeTable(
    ws,
    row,
    ["Branche", "Élèves", "Parents", "Enseignants", "Personnel"],
    effectifs.byBranch.map((b) => [
      b.branchName,
      b.students,
      b.parents,
      b.teachers,
      b.personnel,
    ]),
    [
      "TOTAUX",
      effectifs.students.total,
      effectifs.parents.total,
      effectifs.teachers.total,
      effectifs.personnel.total,
    ],
  );

  row = writeSectionTitle(ws, row, "4. Totaux — Graphiques", 9);
  row = await addChartImage(
    workbook,
    ws,
    renderDonutChartPng({
      data: effectifs.students.byGender,
      width: 400,
      height: 240,
    }),
    row,
    400,
    240,
  );
  row = await addChartImage(
    workbook,
    ws,
    renderBarChartPng({
      categories: effectifs.students.byClass.map((c) => c.name),
      series: [
        { key: "garcons", label: "Garçons", color: REPORT_CHART_COLORS[0] },
        { key: "filles", label: "Filles", color: REPORT_CHART_COLORS[3] },
      ],
      data: effectifs.students.byClass.map((c) => ({
        garcons: c.boys,
        filles: c.girls,
      })),
      stacked: true,
      width: 700,
      height: 240,
    }),
    row,
    700,
    240,
  );

  row = writeSectionTitle(ws, row, "5. Détails — Liste des élèves", 9);
  row = writeTable(
    ws,
    row,
    [
      "#",
      "Matricule",
      "Nom",
      "Postnom",
      "Prénom",
      "Sexe",
      "Statut",
      "Branche",
      "Classe",
    ],
    personTableRows(effectifs.students.list, true),
    [
      "",
      "",
      `Total : ${effectifs.students.total}`,
      "",
      "",
      "",
      `Actifs ${effectifs.students.active}`,
      `Inactifs ${effectifs.students.inactive}`,
      "",
    ],
  );

  row = writeSectionTitle(ws, row, "6. Détails — Liste des parents", 9);
  row = writeTable(
    ws,
    row,
    ["#", "Matricule", "Nom", "Postnom", "Prénom", "Sexe", "Statut", "Branche"],
    personTableRows(effectifs.parents.list, false),
    [
      "",
      "",
      `Total : ${effectifs.parents.total}`,
      "",
      "",
      "",
      `Actifs ${effectifs.parents.active}`,
      `Inactifs ${effectifs.parents.inactive}`,
    ],
  );

  row = writeSectionTitle(ws, row, "7. Détails — Liste des enseignants", 9);
  row = writeTable(
    ws,
    row,
    ["#", "Matricule", "Nom", "Postnom", "Prénom", "Sexe", "Statut", "Branche"],
    personTableRows(effectifs.teachers.list, false),
    [
      "",
      "",
      `Total : ${effectifs.teachers.total}`,
      "",
      "",
      "",
      `Actifs ${effectifs.teachers.active}`,
      `Inactifs ${effectifs.teachers.inactive}`,
    ],
  );

  row = writeSectionTitle(ws, row, "8. Détails — Liste du personnel", 9);
  writeTable(
    ws,
    row,
    ["#", "Matricule", "Nom", "Postnom", "Prénom", "Sexe", "Statut", "Branche"],
    personTableRows(effectifs.personnel.list, false),
    [
      "",
      "",
      `Total : ${effectifs.personnel.total}`,
      "",
      "",
      "",
      `Actifs ${effectifs.personnel.active}`,
      `Inactifs ${effectifs.personnel.inactive}`,
    ],
  );
}

async function buildPresencesSheet(
  workbook: Workbook,
  payload: RapportExcelPayload,
) {
  const { meta, attendance, organizationName } = payload;
  if (!attendance) return;
  const ws = workbook.addWorksheet("Présences", {
    properties: { tabColor: { argb: "FF16A34A" } },
  });
  styleSheet(ws, 10);
  writeBanner(ws, "Présences", meta, 10, organizationName);

  const tracks = [
    { key: "students" as const, label: "Élèves" },
    { key: "teachers" as const, label: "Enseignants" },
    { key: "personnel" as const, label: "Personnel" },
  ];

  let row = 5;
  for (const track of tracks) {
    const data = attendance[track.key];
    row = writeSectionTitle(ws, row, `Mensuels — ${track.label}`, 10);
    row = writeTable(
      ws,
      row,
      ["Mois", "Présents", "Absents", "Retards", "Excusés", "Total"],
      data.byMonth.map((m) => [
        m.label,
        m.present,
        m.absent,
        m.late,
        m.excused,
        m.total,
      ]),
      [
        "TOTAUX",
        data.byMonth.reduce((s, m) => s + m.present, 0),
        data.byMonth.reduce((s, m) => s + m.absent, 0),
        data.byMonth.reduce((s, m) => s + m.late, 0),
        data.byMonth.reduce((s, m) => s + m.excused, 0),
        data.total,
      ],
    );

    row = writeSectionTitle(
      ws,
      row,
      `Synthèse — Absents / retards — ${track.label}`,
      10,
    );
    row = writeTable(
      ws,
      row,
      [
        "#",
        "Matricule",
        "Nom",
        "Classe / Rôle",
        "Branche",
        "Absents",
        "Retards",
        "Total",
      ],
      data.details.map((p, i) => [
        i + 1,
        p.matricule,
        p.name,
        p.role,
        p.branch,
        p.absent,
        p.late,
        p.absent + p.late,
      ]),
      [
        "TOTAUX",
        "",
        `${data.details.length} personne(s)`,
        "",
        "",
        data.details.reduce((s, p) => s + p.absent, 0),
        data.details.reduce((s, p) => s + p.late, 0),
        data.details.reduce((s, p) => s + p.absent + p.late, 0),
      ],
    );

    row = writeSectionTitle(
      ws,
      row,
      `Détails — Absents et retards — ${track.label}`,
      10,
    );
    row = writeTable(
      ws,
      row,
      [
        "#",
        "Date",
        "Heure début",
        "Heure fin",
        "Matricule",
        "Nom",
        "Classe / Rôle",
        "Branche",
        "Statut",
        "Remarque",
      ],
      data.incidents.map((p, i) => [
        i + 1,
        p.date,
        p.time,
        p.endTime,
        p.matricule,
        p.name,
        p.role,
        p.branch,
        p.status,
        p.remark,
      ]),
      [
        "TOTAUX",
        "",
        "",
        "",
        "",
        `${data.incidents.length} pointage(s)`,
        "",
        "",
        "",
        "",
      ],
    );

    row = writeSectionTitle(ws, row, `Totaux — ${track.label}`, 10);
    row = writeKpis(ws, row, [
      { label: "Pointages", value: data.total },
      { label: "Taux présence", value: `${data.presentRate}%` },
    ]);
    row = await addChartImage(
      workbook,
      ws,
      renderDonutChartPng({
        data: data.byStatus.map((s) => ({ name: s.name, value: s.value })),
        width: 400,
        height: 220,
      }),
      row,
      400,
      220,
    );
    ws.getRow(row).addPageBreak();
    row += 1;
  }
}

async function buildFinanceSheet(
  workbook: Workbook,
  payload: RapportExcelPayload,
) {
  const { meta, finance, organizationName } = payload;
  if (!finance) return;
  const currency = meta.currency.baseCurrency;
  const ws = workbook.addWorksheet("Finance", {
    properties: { tabColor: { argb: "FFEA580C" } },
  });
  styleSheet(ws, 10);
  writeBanner(ws, "Finance", meta, 10, organizationName);

  let row = writeSectionTitle(ws, 5, "1. Totaux — Indicateurs élèves", 10);
  row = writeKpis(ws, row, [
    { label: "Total dû", value: money(finance.totalsStudents.due, currency) },
    { label: "Total payé", value: money(finance.totalsStudents.paid, currency) },
    {
      label: "Total reste",
      value: money(finance.totalsStudents.reste, currency),
    },
    { label: "Élèves", value: finance.totalsStudents.count },
  ]);

  row = writeSectionTitle(ws, row, "2. Totaux — Par mois", 10);
  row = writeTable(
    ws,
    row,
    ["Mois", `Récoltes (${currency})`, `Dépenses (${currency})`],
    finance.byMonth.map((m) => [
      m.label,
      money(m.recoltes, currency),
      money(m.depenses, currency),
    ]),
    [
      "TOTAUX",
      money(finance.recoltes, currency),
      money(finance.depenses, currency),
    ],
  );

  row = writeSectionTitle(ws, row, "3. Totaux — Par branche", 10);
  row = writeTable(
    ws,
    row,
    ["Branche", "Budget", "Récolté", "Reste", "Dépenses"],
    finance.byBranch.map((b) => [
      b.branchName,
      money(b.budget, currency),
      money(b.recoltes, currency),
      money(b.reste, currency),
      money(b.depenses, currency),
    ]),
    [
      "TOTAUX",
      money(finance.budgetAnnuel, currency),
      money(finance.recoltes, currency),
      money(finance.reste, currency),
      money(finance.depenses, currency),
    ],
  );

  row = writeSectionTitle(ws, row, "4. Totaux — Graphiques", 10);
  row = await addChartImage(
    workbook,
    ws,
    renderAreaChartPng({
      points: finance.byMonth.map((m) => ({
        label: m.label,
        recoltes: m.recoltes,
        depenses: m.depenses,
      })),
      series: [
        { key: "recoltes", label: "Récoltes", color: REPORT_CHART_COLORS[0] },
        { key: "depenses", label: "Dépenses", color: REPORT_CHART_COLORS[2] },
      ],
      width: 700,
      height: 240,
    }),
    row,
    700,
    240,
  );
  row = await addChartImage(
    workbook,
    ws,
    renderRadialChartPng({
      value: finance.tauxRecouvrement,
      label: "Recouvrement",
    }),
    row,
    280,
    200,
  );

  row = writeSectionTitle(
    ws,
    row,
    "5. Détails — Par élève (frais : dû / payé / reste)",
    10,
  );
  writeTable(
    ws,
    row,
    [
      "Matricule",
      "Nom",
      "Postnom",
      "Prénom",
      "Classe",
      "Année",
      "Frais",
      "Dû",
      "Payé",
      "Reste",
    ],
    finance.studentDetails.flatMap((s) =>
      (s.fees.length > 0
        ? s.fees
        : [{ nameFrais: "—", due: 0, paid: 0, reste: 0 }]
      ).map((f) => [
        s.matricule,
        s.nom,
        s.postnom,
        s.prenom,
        `${s.classeCode} — ${s.classeName}`,
        s.annee,
        f.nameFrais,
        money(f.due, currency),
        money(f.paid, currency),
        money(f.reste, currency),
      ]),
    ),
    [
      "TOTAUX",
      "",
      "",
      `${finance.totalsStudents.count} élève(s)`,
      "",
      "",
      "",
      money(finance.totalsStudents.due, currency),
      money(finance.totalsStudents.paid, currency),
      money(finance.totalsStudents.reste, currency),
    ],
  );
}

async function buildSatisfactionSheet(
  workbook: Workbook,
  payload: RapportExcelPayload,
) {
  const { meta, satisfaction, organizationName } = payload;
  if (!satisfaction) return;
  const ws = workbook.addWorksheet("Satisfaction", {
    properties: { tabColor: { argb: "FF0891B2" } },
  });
  styleSheet(ws, 8);
  writeBanner(ws, "Satisfaction", meta, 8, organizationName);

  let row = writeSectionTitle(ws, 5, "1. Détails — Par branche", 8);
  row = writeTable(
    ws,
    row,
    ["Branche", "Moyenne", "% positifs", "Avis"],
    satisfaction.byBranch.map((b) => [
      b.branchName,
      b.average,
      b.positiveRate,
      b.count,
    ]),
    [
      "TOTAUX",
      satisfaction.averageRating,
      satisfaction.positiveRate,
      satisfaction.totalFeedbacks,
    ],
  );

  row = writeSectionTitle(ws, row, "2. Totaux — Indicateurs & graphique", 8);
  row = writeKpis(ws, row, [
    { label: "Note moyenne", value: `${satisfaction.averageRating}/5` },
    { label: "Positifs ≥4", value: `${satisfaction.positiveRate}%` },
    { label: "Avis", value: satisfaction.totalFeedbacks },
    { label: "Réponse", value: `${satisfaction.responseRate}%` },
  ]);
  await addChartImage(
    workbook,
    ws,
    renderBarChartPng({
      categories: satisfaction.byRating.map((r) => r.name),
      series: [{ key: "value", label: "Avis", color: REPORT_CHART_COLORS[0] }],
      data: satisfaction.byRating.map((r) => ({ value: r.value })),
      width: 520,
      height: 220,
    }),
    row,
    520,
    220,
  );
}

async function buildResultsSheet(
  workbook: Workbook,
  payload: RapportExcelPayload,
) {
  const { meta, results, organizationName } = payload;
  if (!results) return;
  const ws = workbook.addWorksheet("Résultats", {
    properties: { tabColor: { argb: "FFCA8A04" } },
  });
  styleSheet(ws, 8);
  writeBanner(ws, "Résultats scolaires", meta, 8, organizationName);

  let row = writeSectionTitle(ws, 5, "1. Détails — Par classe", 8);
  row = writeTable(
    ws,
    row,
    ["Classe", "Moyenne %", "Réussite %", "Effectif"],
    results.byClass.map((c) => [c.name, c.average, c.successRate, c.count]),
    ["TOTAUX", results.averageScore, results.successRate, results.studentsCount],
  );

  row = writeSectionTitle(ws, row, "2. Totaux — Indicateurs & graphique", 8);
  row = writeKpis(ws, row, [
    { label: "Moyenne", value: `${results.averageScore}%` },
    { label: "Réussite", value: `${results.successRate}%` },
    { label: "Élèves notés", value: results.studentsCount },
    { label: "Admis", value: results.passedCount },
  ]);
  await addChartImage(
    workbook,
    ws,
    renderBarChartPng({
      categories: results.byClass.map((c) => c.name),
      series: [
        { key: "moyenne", label: "Moyenne %", color: REPORT_CHART_COLORS[0] },
        { key: "reussite", label: "Réussite %", color: REPORT_CHART_COLORS[1] },
      ],
      data: results.byClass.map((c) => ({
        moyenne: c.average,
        reussite: c.successRate,
      })),
      width: 700,
      height: 240,
    }),
    row,
    700,
    240,
  );
}

async function buildRhSheet(
  workbook: Workbook,
  payload: RapportExcelPayload,
) {
  const { meta, hiring, organizationName } = payload;
  if (!hiring) return;
  const ws = workbook.addWorksheet("RH Candidatures", {
    properties: { tabColor: { argb: "FF64748B" } },
  });
  styleSheet(ws, 8);
  writeBanner(ws, "RH / Candidatures", meta, 8, organizationName);

  let row = writeSectionTitle(ws, 5, "1. Détails — Par statut", 8);
  row = writeTable(
    ws,
    row,
    ["Statut", "Volume"],
    hiring.byStatus.map((s) => [s.name, s.value]),
    ["TOTAUX", hiring.total],
  );

  row = writeSectionTitle(ws, row, "2. Détails — Par branche", 8);
  row = writeTable(
    ws,
    row,
    ["Branche", "Total", "Embauchés", "Refusés"],
    hiring.byBranch.map((b) => [b.branchName, b.total, b.hired, b.rejected]),
    ["TOTAUX", hiring.total, hiring.hired, hiring.rejected],
  );

  row = writeSectionTitle(ws, row, "3. Totaux — Indicateurs & graphique", 8);
  row = writeKpis(ws, row, [
    { label: "Candidatures", value: hiring.total },
    { label: "Acceptées", value: hiring.accepted },
    { label: "Refusées", value: hiring.rejected },
    { label: "Embauchées", value: hiring.hired },
  ]);
  await addChartImage(
    workbook,
    ws,
    renderBarChartPng({
      categories: hiring.byStatus.map((s) => s.name),
      series: [{ key: "value", label: "Volume", color: REPORT_CHART_COLORS[0] }],
      data: hiring.byStatus.map((s) => ({ value: s.value })),
      width: 620,
      height: 220,
    }),
    row,
    620,
    220,
  );
}

async function buildInscriptionsSheet(
  workbook: Workbook,
  payload: RapportExcelPayload,
) {
  const { meta, registrations, organizationName } = payload;
  if (!registrations) return;
  const ws = workbook.addWorksheet("Inscriptions", {
    properties: { tabColor: { argb: "FF0F766E" } },
  });
  styleSheet(ws, 8);
  writeBanner(ws, "Inscriptions", meta, 8, organizationName);

  let row = writeSectionTitle(ws, 5, "1. Détails — Par statut", 8);
  row = writeTable(
    ws,
    row,
    ["Statut", "Volume"],
    registrations.byStatus.map((s) => [s.name, s.value]),
    ["TOTAUX", registrations.total],
  );

  row = writeSectionTitle(ws, row, "2. Détails — Par branche", 8);
  row = writeTable(
    ws,
    row,
    ["Branche", "Demandes", "Inscrites", "Refusées"],
    registrations.byBranch.map((b) => [
      b.branchName,
      b.total,
      b.registered,
      b.rejected,
    ]),
    [
      "TOTAUX",
      registrations.total,
      registrations.registered,
      registrations.rejected,
    ],
  );

  row = writeSectionTitle(ws, row, "3. Totaux — Indicateurs & graphique", 8);
  row = writeKpis(ws, row, [
    { label: "Demandes", value: registrations.total },
    { label: "Inscrites", value: registrations.registered },
    { label: "Refusées", value: registrations.rejected },
    { label: "Conversion", value: `${registrations.conversionRate}%` },
  ]);
  await addChartImage(
    workbook,
    ws,
    renderBarChartPng({
      categories: registrations.byMonth.map((m) => m.label),
      series: [
        { key: "total", label: "Demandes", color: REPORT_CHART_COLORS[0] },
        { key: "inscrites", label: "Inscrites", color: REPORT_CHART_COLORS[1] },
      ],
      data: registrations.byMonth.map((m) => ({
        total: m.total,
        inscrites: m.registered,
      })),
      width: 700,
      height: 220,
    }),
    row,
    700,
    220,
  );
}

export async function exportRapportOrganisationExcel(
  payload: RapportExcelPayload,
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eteyelo";
  workbook.created = new Date();
  workbook.modified = new Date();

  const tab = payload.tab ?? "overview";
  const exportAll = tab === "overview";

  if (exportAll) {
    await buildOverviewSheet(workbook, payload);
    await buildEffectifsSheet(workbook, payload);
    await buildPresencesSheet(workbook, payload);
    await buildFinanceSheet(workbook, payload);
    await buildSatisfactionSheet(workbook, payload);
    await buildResultsSheet(workbook, payload);
    await buildRhSheet(workbook, payload);
    await buildInscriptionsSheet(workbook, payload);
  } else if (tab === "effectifs") {
    await buildEffectifsSheet(workbook, payload);
  } else if (tab === "presences") {
    await buildPresencesSheet(workbook, payload);
  } else if (tab === "finance") {
    await buildFinanceSheet(workbook, payload);
  } else if (tab === "satisfaction") {
    await buildSatisfactionSheet(workbook, payload);
  } else if (tab === "resultats") {
    await buildResultsSheet(workbook, payload);
  } else if (tab === "rh") {
    await buildRhSheet(workbook, payload);
  } else if (tab === "inscriptions") {
    await buildInscriptionsSheet(workbook, payload);
  }

  if (workbook.worksheets.length === 0) {
    throw new Error("Aucune donnée à exporter pour cet onglet.");
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  const tabSlug = exportAll ? "complet" : tab;
  a.href = url;
  a.download = `rapport-${tabSlug}-${date}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
