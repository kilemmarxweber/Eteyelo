import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatReportAmount } from "@/lib/reports/format-amount";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  renderAreaChartPng,
  renderBarChartPng,
  renderDonutChartPng,
  renderRadialChartPng,
  REPORT_CHART_COLORS,
} from "@/lib/reports/chart-canvas";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
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

export type RapportCompletPdfPayload = {
  meta: ReportMeta;
  /** Onglet actif : `overview` = rapport complet, sinon seulement cet onglet. */
  tab?: ReportTab;
  overview: OverviewReport | null;
  effectifs: EffectifsReport | null;
  attendance: AttendanceReport | null;
  finance: FinanceReport | null;
  satisfaction: SatisfactionReport | null;
  results: ResultsReport | null;
  hiring: HiringReport | null;
  registrations: RegistrationReport | null;
};

type HeaderOpts = {
  title: string;
  details?: string[];
};

type Layout = {
  doc: jsPDF;
  context: SchoolReportContext;
  logo: string | null;
  currency: CurrencyCode;
  money: (v: number) => string;
  meta: ReportMeta;
  header: HeaderOpts;
  contentTop: number;
  y: number;
};

const MARGIN_X = 14;
const FOOTER_GAP = 18;

const TABLE_THEME = {
  theme: "striped" as const,
  styles: {
    font: "helvetica" as const,
    fontSize: 8,
    cellPadding: 2.2,
    overflow: "linebreak" as const,
    valign: "middle" as const,
    textColor: [30, 41, 59] as [number, number, number],
    lineColor: [226, 232, 240] as [number, number, number],
    lineWidth: 0.2,
  },
  headStyles: {
    fillColor: [30, 64, 175] as [number, number, number],
    textColor: 255,
    fontStyle: "bold" as const,
    fontSize: 8,
    halign: "left" as const,
  },
  alternateRowStyles: {
    fillColor: [248, 250, 252] as [number, number, number],
  },
  showHead: "everyPage" as const,
};

function scopeLabel(meta: ReportMeta) {
  if (meta.scope === "all") return "Toutes les branches";
  const branch = meta.branches.find((b) => b.id === meta.selectedBranchId);
  return branch?.name ?? "Branche";
}

function yearLabel(meta: ReportMeta) {
  if (meta.schoolYearKey === "all") return "Toutes les années";
  return (
    meta.schoolYears.find((y) => y.key === meta.schoolYearKey)?.label ??
    meta.schoolYearKey
  );
}

function lastTableY(doc: jsPDF): number {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? REPORT_HEADER_CONTENT_TOP_MM
  );
}

function paintHeader(layout: Layout): number {
  return drawReportHeader(layout.doc, layout.context, {
    title: layout.header.title,
    subtitle: layout.context.branchName || layout.context.schoolName,
    details: layout.header.details ?? [],
    logoDataUrl: layout.logo,
  });
}

function beginSection(
  layout: Layout,
  title: string,
  details: string[] = [],
  options?: { firstSection?: boolean },
) {
  layout.header = { title, details };
  if (!options?.firstSection) {
    layout.doc.addPage();
  }
  layout.contentTop = paintHeader(layout);
  layout.y = layout.contentTop;
}

function ensureY(layout: Layout, needed: number): void {
  const pageH = layout.doc.internal.pageSize.getHeight();
  if (layout.y + needed <= pageH - FOOTER_GAP) return;
  layout.doc.addPage();
  layout.contentTop = paintHeader(layout);
  layout.y = layout.contentTop;
}

function sectionTitle(layout: Layout, title: string) {
  ensureY(layout, 14);
  layout.doc.setFont("helvetica", "bold");
  layout.doc.setFontSize(11);
  layout.doc.setTextColor(30, 64, 175);
  layout.doc.text(title, MARGIN_X, layout.y + 4);
  layout.doc.setDrawColor(191, 219, 254);
  layout.doc.setLineWidth(0.35);
  const pageW = layout.doc.internal.pageSize.getWidth();
  layout.doc.line(MARGIN_X, layout.y + 6, pageW - MARGIN_X, layout.y + 6);
  layout.y += 12;
}

function drawKpis(
  layout: Layout,
  kpis: Array<{ label: string; value: string }>,
) {
  const pageW = layout.doc.internal.pageSize.getWidth();
  const gap = 3;
  const cols = Math.min(4, Math.max(1, kpis.length));
  const cardW = (pageW - MARGIN_X * 2 - gap * (cols - 1)) / cols;
  const cardH = 15;

  ensureY(layout, cardH + 4);
  let rowY = layout.y;

  kpis.forEach((kpi, i) => {
    const col = i % cols;
    if (col === 0 && i > 0) {
      rowY += cardH + gap;
      layout.y = rowY;
      ensureY(layout, cardH + 4);
      rowY = layout.y;
    }
    const x = MARGIN_X + col * (cardW + gap);
    layout.doc.setFillColor(248, 250, 252);
    layout.doc.setDrawColor(203, 213, 225);
    layout.doc.roundedRect(x, rowY, cardW, cardH, 1.5, 1.5, "FD");
    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(7);
    layout.doc.setTextColor(100, 116, 139);
    layout.doc.text(kpi.label, x + 2.5, rowY + 5, { maxWidth: cardW - 5 });
    layout.doc.setFont("helvetica", "bold");
    layout.doc.setFontSize(10);
    layout.doc.setTextColor(15, 23, 42);
    layout.doc.text(kpi.value, x + 2.5, rowY + 11.5, {
      maxWidth: cardW - 5,
    });
  });

  layout.y = rowY + cardH + 8;
}

function addChart(
  layout: Layout,
  dataUrl: string,
  widthMm: number,
  heightMm: number,
) {
  ensureY(layout, heightMm + 6);
  try {
    layout.doc.addImage(
      dataUrl,
      "PNG",
      MARGIN_X,
      layout.y,
      widthMm,
      heightMm,
    );
  } catch {
    // ignore
  }
  layout.y += heightMm + 8;
}

function drawTable(
  layout: Layout,
  head: string[],
  body: Array<Array<string | number>>,
  options?: { totalsRow?: Array<string | number> },
) {
  const rows =
    body.length > 0
      ? body
      : [["Aucune donnée", ...head.slice(1).map(() => "—")]];

  if (options?.totalsRow) {
    rows.push(options.totalsRow);
  }

  autoTable(layout.doc, {
    startY: layout.y,
    margin: {
      top: layout.contentTop,
      right: MARGIN_X,
      bottom: FOOTER_GAP,
      left: MARGIN_X,
    },
    head: [head],
    body: rows,
    ...TABLE_THEME,
    didDrawPage: (hook) => {
      // Ne redessiner l'en-tête que sur les pages suivantes (évite le chevauchement page 1).
      if (hook.pageNumber > 1) {
        paintHeader(layout);
      }
    },
    didParseCell: (data) => {
      if (
        options?.totalsRow &&
        data.section === "body" &&
        data.row.index === rows.length - 1
      ) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [219, 234, 254];
      }
    },
  });

  layout.y = lastTableY(layout.doc) + 10;
  layout.contentTop = Math.max(layout.contentTop, REPORT_HEADER_CONTENT_TOP_MM);
}

function personRows(list: EffectifsPersonRow[], withClass: boolean) {
  return list.map((p, i) => {
    const base: Array<string | number> = [
      i + 1,
      p.matricule,
      p.nom,
      p.postnom,
      p.prenom,
      p.sexe,
      p.statut,
      p.branche,
    ];
    if (withClass) base.push(p.classe ?? "—");
    return base;
  });
}

function buildOverview(layout: Layout, data: OverviewReport) {
  layout.header = {
    title: "Vue d'ensemble",
    details: [scopeLabel(layout.meta), yearLabel(layout.meta)],
  };
  layout.contentTop = paintHeader(layout);
  layout.y = layout.contentTop;

  sectionTitle(layout, "1. Détails — Comparaison inter-branches");
  drawTable(
    layout,
    ["Branche", "Élèves", "Récoltes", "Satisfaction", "Réussite %"],
    data.comparison.map((c) => [
      c.branchName,
      c.students,
      layout.money(c.recoltes),
      c.satisfaction,
      c.successRate,
    ]),
    {
      totalsRow: [
        "TOTAUX",
        data.students,
        layout.money(data.recoltes),
        data.satisfaction,
        data.successRate,
      ],
    },
  );

  sectionTitle(layout, "2. Totaux — Indicateurs");
  drawKpis(layout, [
    { label: "Élèves", value: String(data.students) },
    { label: "Enseignants", value: String(data.teachers) },
    { label: "Parents", value: String(data.parents) },
    { label: "Personnel", value: String(data.personnel) },
    { label: "Présence", value: `${data.attendanceRate}%` },
    { label: "Récolté", value: layout.money(data.recoltes) },
    { label: "Réussite", value: `${data.successRate}%` },
    { label: "Satisfaction", value: `${data.satisfaction}/5` },
  ]);

  sectionTitle(layout, "3. Totaux — Graphique");
  addChart(
    layout,
    renderBarChartPng({
      categories: data.comparison.map((c) => c.branchName),
      series: [
        { key: "eleves", label: "Élèves", color: REPORT_CHART_COLORS[0] },
        { key: "recoltes", label: "Récoltes", color: REPORT_CHART_COLORS[1] },
      ],
      data: data.comparison.map((c) => ({
        eleves: c.students,
        recoltes: c.recoltes,
      })),
      width: 700,
      height: 260,
    }),
    182,
    68,
  );
}

function buildEffectifs(
  layout: Layout,
  data: EffectifsReport,
  options?: { firstSection?: boolean },
) {
  beginSection(
    layout,
    "Effectifs",
    [`${data.students.total} élèves`, scopeLabel(layout.meta)],
    options,
  );

  sectionTitle(layout, "1. Totaux — Indicateurs");
  drawKpis(layout, [
    { label: "Élèves", value: String(data.students.total) },
    { label: "Parents", value: String(data.parents.total) },
    { label: "Enseignants", value: String(data.teachers.total) },
    { label: "Personnel", value: String(data.personnel.total) },
  ]);

  sectionTitle(layout, "2. Totaux — Par classe");
  drawTable(
    layout,
    ["Classe", "Total", "Garçons", "Filles"],
    data.students.byClass.map((c) => [c.name, c.total, c.boys, c.girls]),
    {
      totalsRow: [
        "TOTAUX",
        data.students.byClass.reduce((s, c) => s + c.total, 0),
        data.students.byClass.reduce((s, c) => s + c.boys, 0),
        data.students.byClass.reduce((s, c) => s + c.girls, 0),
      ],
    },
  );

  sectionTitle(layout, "3. Totaux — Par branche");
  drawTable(
    layout,
    ["Branche", "Élèves", "Parents", "Enseignants", "Personnel"],
    data.byBranch.map((b) => [
      b.branchName,
      b.students,
      b.parents,
      b.teachers,
      b.personnel,
    ]),
    {
      totalsRow: [
        "TOTAUX",
        data.students.total,
        data.parents.total,
        data.teachers.total,
        data.personnel.total,
      ],
    },
  );

  sectionTitle(layout, "4. Totaux — Graphiques");
  addChart(
    layout,
    renderDonutChartPng({
      data: data.students.byGender,
      width: 400,
      height: 240,
    }),
    100,
    60,
  );
  addChart(
    layout,
    renderBarChartPng({
      categories: data.students.byClass.map((c) => c.name),
      series: [
        { key: "garcons", label: "Garçons", color: REPORT_CHART_COLORS[0] },
        { key: "filles", label: "Filles", color: REPORT_CHART_COLORS[3] },
      ],
      data: data.students.byClass.map((c) => ({
        garcons: c.boys,
        filles: c.girls,
      })),
      stacked: true,
      width: 700,
      height: 240,
    }),
    182,
    62,
  );

  sectionTitle(layout, "5. Détails — Liste des élèves");
  drawTable(
    layout,
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
    personRows(data.students.list, true),
    {
      totalsRow: [
        "",
        "",
        `Total élèves : ${data.students.total}`,
        "",
        "",
        "",
        `Actifs ${data.students.active}`,
        `Inactifs ${data.students.inactive}`,
        "",
      ],
    },
  );

  sectionTitle(layout, "6. Détails — Liste des parents");
  drawTable(
    layout,
    ["#", "Matricule", "Nom", "Postnom", "Prénom", "Sexe", "Statut", "Branche"],
    personRows(data.parents.list, false),
    {
      totalsRow: [
        "",
        "",
        `Total parents : ${data.parents.total}`,
        "",
        "",
        "",
        `Actifs ${data.parents.active}`,
        `Inactifs ${data.parents.inactive}`,
      ],
    },
  );

  sectionTitle(layout, "7. Détails — Liste des enseignants");
  drawTable(
    layout,
    ["#", "Matricule", "Nom", "Postnom", "Prénom", "Sexe", "Statut", "Branche"],
    personRows(data.teachers.list, false),
    {
      totalsRow: [
        "",
        "",
        `Total enseignants : ${data.teachers.total}`,
        "",
        "",
        "",
        `Actifs ${data.teachers.active}`,
        `Inactifs ${data.teachers.inactive}`,
      ],
    },
  );

  sectionTitle(layout, "8. Détails — Liste du personnel");
  drawTable(
    layout,
    ["#", "Matricule", "Nom", "Postnom", "Prénom", "Sexe", "Statut", "Branche"],
    personRows(data.personnel.list, false),
    {
      totalsRow: [
        "",
        "",
        `Total personnel : ${data.personnel.total}`,
        "",
        "",
        "",
        `Actifs ${data.personnel.active}`,
        `Inactifs ${data.personnel.inactive}`,
      ],
    },
  );
}

function buildPresences(
  layout: Layout,
  data: AttendanceReport,
  options?: { firstSection?: boolean },
) {
  beginSection(
    layout,
    "Présences",
    [`Taux élèves ${data.students.presentRate}%`, scopeLabel(layout.meta)],
    options,
  );

  const tracks = [
    { key: "students" as const, label: "Élèves" },
    { key: "teachers" as const, label: "Enseignants" },
    { key: "personnel" as const, label: "Personnel" },
  ];

  tracks.forEach((track, idx) => {
    const t = data[track.key];
    sectionTitle(layout, `${idx + 1}. Mensuels — ${track.label}`);
    drawTable(
      layout,
      ["Mois", "Présents", "Absents", "Retards", "Excusés", "Total"],
      t.byMonth.map((m) => [
        m.label,
        m.present,
        m.absent,
        m.late,
        m.excused,
        m.total,
      ]),
      {
        totalsRow: [
          "TOTAUX",
          t.byMonth.reduce((s, m) => s + m.present, 0),
          t.byMonth.reduce((s, m) => s + m.absent, 0),
          t.byMonth.reduce((s, m) => s + m.late, 0),
          t.byMonth.reduce((s, m) => s + m.excused, 0),
          t.total,
        ],
      },
    );

    sectionTitle(layout, `${idx + 1}b. Synthèse — Absents / retards — ${track.label}`);
    drawTable(
      layout,
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
      t.details.map((p, i) => [
        i + 1,
        p.matricule,
        p.name,
        p.role,
        p.branch,
        p.absent,
        p.late,
        p.absent + p.late,
      ]),
      {
        totalsRow: [
          "TOTAUX",
          "",
          `${t.details.length} personne(s)`,
          "",
          "",
          t.details.reduce((s, p) => s + p.absent, 0),
          t.details.reduce((s, p) => s + p.late, 0),
          t.details.reduce((s, p) => s + p.absent + p.late, 0),
        ],
      },
    );

    sectionTitle(
      layout,
      `${idx + 1}c. Détails — Absents et retards — ${track.label}`,
    );
    drawTable(
      layout,
      [
        "#",
        "Date",
        "Heure",
        "Matricule",
        "Nom",
        "Classe / Rôle",
        "Branche",
        "Statut",
        "Remarque",
      ],
      t.incidents.map((p, i) => [
        i + 1,
        p.date,
        p.time,
        p.matricule,
        p.name,
        p.role,
        p.branch,
        p.status,
        p.remark,
      ]),
      {
        totalsRow: [
          "TOTAUX",
          "",
          "",
          "",
          `${t.incidents.length} pointage(s)`,
          "",
          "",
          "",
          "",
        ],
      },
    );

    sectionTitle(layout, `${idx + 1}d. Totaux — ${track.label}`);
    drawKpis(layout, [
      { label: "Pointages", value: String(t.total) },
      { label: "Taux présence", value: `${t.presentRate}%` },
    ]);
    addChart(
      layout,
      renderDonutChartPng({
        data: t.byStatus.map((s) => ({ name: s.name, value: s.value })),
        width: 400,
        height: 220,
      }),
      95,
      52,
    );
  });
}

function buildFinance(
  layout: Layout,
  data: FinanceReport,
  options?: { firstSection?: boolean },
) {
  const classeLabel =
    layout.meta.classeKey === "all"
      ? "Toutes les classes"
      : (layout.meta.classes.find((c) => c.key === layout.meta.classeKey)
          ?.label ?? layout.meta.classeKey);

  beginSection(
    layout,
    "Finance",
    [
      `Recouvrement ${data.tauxRecouvrement}%`,
      scopeLabel(layout.meta),
      yearLabel(layout.meta),
      classeLabel,
    ],
    options,
  );

  sectionTitle(layout, "1. Totaux — Indicateurs élèves");
  drawKpis(layout, [
    { label: "Total dû", value: layout.money(data.totalsStudents.due) },
    { label: "Total payé", value: layout.money(data.totalsStudents.paid) },
    { label: "Total reste", value: layout.money(data.totalsStudents.reste) },
    { label: "Élèves", value: String(data.totalsStudents.count) },
  ]);

  sectionTitle(layout, "2. Totaux — Par mois");
  drawTable(
    layout,
    [
      "Mois",
      `Récoltes (${layout.currency})`,
      `Dépenses (${layout.currency})`,
    ],
    data.byMonth.map((m) => [
      m.label,
      layout.money(m.recoltes),
      layout.money(m.depenses),
    ]),
    {
      totalsRow: [
        "TOTAUX",
        layout.money(data.recoltes),
        layout.money(data.depenses),
      ],
    },
  );

  sectionTitle(layout, "3. Totaux — Par branche");
  drawTable(
    layout,
    ["Branche", "Budget", "Récolté", "Reste", "Dépenses"],
    data.byBranch.map((b) => [
      b.branchName,
      layout.money(b.budget),
      layout.money(b.recoltes),
      layout.money(b.reste),
      layout.money(b.depenses),
    ]),
    {
      totalsRow: [
        "TOTAUX",
        layout.money(data.budgetAnnuel),
        layout.money(data.recoltes),
        layout.money(data.reste),
        layout.money(data.depenses),
      ],
    },
  );

  sectionTitle(layout, "4. Totaux — Graphiques");
  addChart(
    layout,
    renderAreaChartPng({
      points: data.byMonth.map((m) => ({
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
    182,
    62,
  );
  addChart(
    layout,
    renderRadialChartPng({
      value: data.tauxRecouvrement,
      label: "Recouvrement",
    }),
    70,
    55,
  );

  sectionTitle(layout, "5. Détails — Par élève (frais : dû / payé / reste)");
  drawTable(
    layout,
    [
      "Matricule",
      "Nom",
      "Classe",
      "Année",
      "Frais",
      "Dû",
      "Payé",
      "Reste",
    ],
    data.studentDetails.flatMap((s) =>
      (s.fees.length > 0
        ? s.fees
        : [{ nameFrais: "—", due: 0, paid: 0, reste: 0 }]
      ).map((f) => [
        s.matricule,
        `${s.nom} ${s.postnom} ${s.prenom}`.trim(),
        s.classeCode,
        s.annee,
        f.nameFrais,
        layout.money(f.due),
        layout.money(f.paid),
        layout.money(f.reste),
      ]),
    ),
    {
      totalsRow: [
        "TOTAUX",
        `${data.totalsStudents.count} élève(s)`,
        "",
        "",
        "",
        layout.money(data.totalsStudents.due),
        layout.money(data.totalsStudents.paid),
        layout.money(data.totalsStudents.reste),
      ],
    },
  );
}

function buildSatisfaction(
  layout: Layout,
  data: SatisfactionReport,
  options?: { firstSection?: boolean },
) {
  beginSection(
    layout,
    "Satisfaction",
    [`${data.averageRating}/5`, scopeLabel(layout.meta)],
    options,
  );

  sectionTitle(layout, "1. Détails — Par branche");
  drawTable(
    layout,
    ["Branche", "Moyenne", "% positifs", "Avis"],
    data.byBranch.map((b) => [b.branchName, b.average, b.positiveRate, b.count]),
    {
      totalsRow: [
        "TOTAUX",
        data.averageRating,
        data.positiveRate,
        data.totalFeedbacks,
      ],
    },
  );

  sectionTitle(layout, "2. Détails — Par mois");
  drawTable(
    layout,
    ["Mois", "Moyenne", "Avis"],
    data.byMonth.map((m) => [m.label, m.average, m.count]),
  );

  sectionTitle(layout, "3. Totaux — Indicateurs & graphiques");
  drawKpis(layout, [
    { label: "Note moyenne", value: `${data.averageRating}/5` },
    { label: "Positifs", value: `${data.positiveRate}%` },
    { label: "Avis", value: String(data.totalFeedbacks) },
    { label: "Réponse", value: `${data.responseRate}%` },
  ]);
  addChart(
    layout,
    renderBarChartPng({
      categories: data.byRating.map((r) => r.name),
      series: [{ key: "value", label: "Avis", color: REPORT_CHART_COLORS[0] }],
      data: data.byRating.map((r) => ({ value: r.value })),
      width: 520,
      height: 220,
    }),
    140,
    58,
  );
}

function buildResults(
  layout: Layout,
  data: ResultsReport,
  options?: { firstSection?: boolean },
) {
  beginSection(
    layout,
    "Résultats",
    [`Réussite ${data.successRate}%`, scopeLabel(layout.meta)],
    options,
  );

  sectionTitle(layout, "1. Détails — Par classe");
  drawTable(
    layout,
    ["Classe", "Moyenne %", "Réussite %", "Effectif"],
    data.byClass.map((c) => [c.name, c.average, c.successRate, c.count]),
    {
      totalsRow: [
        "TOTAUX",
        data.averageScore,
        data.successRate,
        data.studentsCount,
      ],
    },
  );

  sectionTitle(layout, "2. Totaux — Indicateurs & graphique");
  drawKpis(layout, [
    { label: "Moyenne", value: `${data.averageScore}%` },
    { label: "Réussite", value: `${data.successRate}%` },
    { label: "Élèves notés", value: String(data.studentsCount) },
    { label: "Admis", value: String(data.passedCount) },
  ]);
  addChart(
    layout,
    renderBarChartPng({
      categories: data.byClass.map((c) => c.name),
      series: [
        { key: "moyenne", label: "Moyenne %", color: REPORT_CHART_COLORS[0] },
        { key: "reussite", label: "Réussite %", color: REPORT_CHART_COLORS[1] },
      ],
      data: data.byClass.map((c) => ({
        moyenne: c.average,
        reussite: c.successRate,
      })),
      width: 700,
      height: 240,
    }),
    182,
    62,
  );
}

function buildRh(
  layout: Layout,
  data: HiringReport,
  options?: { firstSection?: boolean },
) {
  beginSection(
    layout,
    "RH / Candidatures",
    [`${data.hired} embauches`, scopeLabel(layout.meta)],
    options,
  );

  sectionTitle(layout, "1. Détails — Par statut");
  drawTable(
    layout,
    ["Statut", "Volume"],
    data.byStatus.map((s) => [s.name, s.value]),
    { totalsRow: ["TOTAUX", data.total] },
  );

  sectionTitle(layout, "2. Détails — Par branche");
  drawTable(
    layout,
    ["Branche", "Total", "Embauchés", "Refusés"],
    data.byBranch.map((b) => [b.branchName, b.total, b.hired, b.rejected]),
    {
      totalsRow: ["TOTAUX", data.total, data.hired, data.rejected],
    },
  );

  sectionTitle(layout, "3. Totaux — Indicateurs & graphique");
  drawKpis(layout, [
    { label: "Candidatures", value: String(data.total) },
    { label: "Acceptées", value: String(data.accepted) },
    { label: "Refusées", value: String(data.rejected) },
    { label: "Embauchées", value: String(data.hired) },
  ]);
  addChart(
    layout,
    renderBarChartPng({
      categories: data.byStatus.map((s) => s.name),
      series: [{ key: "value", label: "Volume", color: REPORT_CHART_COLORS[0] }],
      data: data.byStatus.map((s) => ({ value: s.value })),
      width: 620,
      height: 220,
    }),
    165,
    58,
  );
}

function buildInscriptions(
  layout: Layout,
  data: RegistrationReport,
  options?: { firstSection?: boolean },
) {
  beginSection(
    layout,
    "Inscriptions",
    [`Conversion ${data.conversionRate}%`, scopeLabel(layout.meta)],
    options,
  );

  sectionTitle(layout, "1. Détails — Par statut");
  drawTable(
    layout,
    ["Statut", "Volume"],
    data.byStatus.map((s) => [s.name, s.value]),
    { totalsRow: ["TOTAUX", data.total] },
  );

  sectionTitle(layout, "2. Détails — Par branche");
  drawTable(
    layout,
    ["Branche", "Demandes", "Inscrites", "Refusées"],
    data.byBranch.map((b) => [b.branchName, b.total, b.registered, b.rejected]),
    {
      totalsRow: [
        "TOTAUX",
        data.total,
        data.registered,
        data.rejected,
      ],
    },
  );

  sectionTitle(layout, "3. Totaux — Indicateurs & graphique");
  drawKpis(layout, [
    { label: "Demandes", value: String(data.total) },
    { label: "Inscrites", value: String(data.registered) },
    { label: "Refusées", value: String(data.rejected) },
    { label: "Conversion", value: `${data.conversionRate}%` },
  ]);
  addChart(
    layout,
    renderBarChartPng({
      categories: data.byMonth.map((m) => m.label),
      series: [
        { key: "total", label: "Demandes", color: REPORT_CHART_COLORS[0] },
        { key: "inscrites", label: "Inscrites", color: REPORT_CHART_COLORS[1] },
      ],
      data: data.byMonth.map((m) => ({
        total: m.total,
        inscrites: m.registered,
      })),
      width: 700,
      height: 220,
    }),
    182,
    58,
  );
}

export async function buildRapportCompletPdf(
  payload: RapportCompletPdfPayload,
  context: SchoolReportContext,
) {
  const currency = payload.meta.currency.baseCurrency;
  const money = (value: number) => formatReportAmount(value, currency);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const tab = payload.tab ?? "overview";
  const exportAll = tab === "overview";

  const layout: Layout = {
    doc,
    context,
    logo,
    currency,
    money,
    meta: payload.meta,
    header: { title: "Rapport organisation" },
    contentTop: REPORT_HEADER_CONTENT_TOP_MM,
    y: REPORT_HEADER_CONTENT_TOP_MM,
  };

  const first = { firstSection: true as const };

  if (exportAll) {
    if (payload.overview) {
      buildOverview(layout, payload.overview);
    } else {
      layout.contentTop = paintHeader(layout);
      layout.y = layout.contentTop;
    }
    if (payload.effectifs) buildEffectifs(layout, payload.effectifs);
    if (payload.attendance) buildPresences(layout, payload.attendance);
    if (payload.finance) buildFinance(layout, payload.finance);
    if (payload.satisfaction) buildSatisfaction(layout, payload.satisfaction);
    if (payload.results) buildResults(layout, payload.results);
    if (payload.hiring) buildRh(layout, payload.hiring);
    if (payload.registrations) buildInscriptions(layout, payload.registrations);
  } else if (tab === "effectifs" && payload.effectifs) {
    buildEffectifs(layout, payload.effectifs, first);
  } else if (tab === "presences" && payload.attendance) {
    buildPresences(layout, payload.attendance, first);
  } else if (tab === "finance" && payload.finance) {
    buildFinance(layout, payload.finance, first);
  } else if (tab === "satisfaction" && payload.satisfaction) {
    buildSatisfaction(layout, payload.satisfaction, first);
  } else if (tab === "resultats" && payload.results) {
    buildResults(layout, payload.results, first);
  } else if (tab === "rh" && payload.hiring) {
    buildRh(layout, payload.hiring, first);
  } else if (tab === "inscriptions" && payload.registrations) {
    buildInscriptions(layout, payload.registrations, first);
  } else {
    throw new Error("Aucune donnée pour cet onglet.");
  }

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  return doc;
}

export async function exportRapportCompletPdf(
  payload: RapportCompletPdfPayload,
  context: SchoolReportContext,
) {
  const date = new Date().toISOString().slice(0, 10);
  const tab = payload.tab ?? "overview";
  const tabSlug =
    tab === "overview"
      ? "complet"
      : tab
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "-");
  const branchPart = context.branchName
    ? `-${context.branchName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()}`
    : "";
  const doc = await buildRapportCompletPdf(payload, context);
  doc.save(`rapport-${tabSlug}${branchPart}-${date}.pdf`);
}

/** @deprecated Prefer exportRapportCompletPdf */
export type RapportEffectifsPdfData = {
  summary: {
    totalStudents: number;
    activeStudents: number;
    inactiveStudents: number;
    boys: number;
    girls: number;
    teachers: number;
    parents: number;
    totalPayments: number;
    totalExpenses: number;
    balance: number;
  };
  studentsByClass: Array<{ name: string; total: number }>;
  genderStats: Array<{ name: string; value: number }>;
  statusStats: Array<{ name: string; value: number }>;
  attendanceStats: Array<{ name: string; value: number }>;
  financeByMonth: Array<{
    month: string;
    paiements: number;
    depenses: number;
  }>;
  currency?: CurrencyCode;
  rateLabel?: string | null;
};

/** @deprecated Prefer exportRapportCompletPdf */
export async function buildRapportEffectifsPdf(
  data: RapportEffectifsPdfData,
  context: SchoolReportContext,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  drawReportHeader(doc, context, {
    title: "Synthèse des effectifs",
    subtitle: context.branchName,
    logoDataUrl: logo,
  });
  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    head: [["Indicateur", "Valeur"]],
    body: [
      ["Élèves actifs", data.summary.activeStudents],
      ["Total élèves", data.summary.totalStudents],
      ["Enseignants", data.summary.teachers],
      ["Parents", data.summary.parents],
    ],
    ...TABLE_THEME,
  });
  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });
  return doc;
}

/** @deprecated Prefer exportRapportCompletPdf */
export async function exportRapportEffectifsPdf(
  data: RapportEffectifsPdfData,
  context: SchoolReportContext,
) {
  const date = new Date().toISOString().slice(0, 10);
  const doc = await buildRapportEffectifsPdf(data, context);
  doc.save(`synthese-effectifs-${date}.pdf`);
}
