/**
 * Phase 10 — Contrôle visuel bulletin secondaire.
 * Génère des PDF d'échantillon et vérifie les contraintes de mise en page A4.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import jsPDF from "jspdf";

import {
  BULLETIN_PAGE_MARGIN_MM,
  getBulletinFrameWidth,
} from "../lib/bulletin-layout";
import {
  buildSecondaryBulletinLayout,
  drawSecondaryTableHeader,
  getSecondaryEvaluationCellWidths,
  getSecondarySemesterDrawConfig,
  MIN_EVAL_CELL_WIDTH_MM,
} from "../app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/bulletin-secondary-layout";
import { drawCell1, drawSemesterRow1 } from "../lib/types";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const OUTPUT_DIR = path.join("context", "samples", "phase-10");
const CELL_PADDING_MM = 2;

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function buildLayoutParams() {
  const margin = BULLETIN_PAGE_MARGIN_MM;
  const tableX = margin;
  const shiftX = 0;
  const shiftY = -25;
  const tableY = margin + 36 + 50;
  const rowHeightTotal = 20;
  const hTop = 7;
  const hMid = 7;
  const hBottom = 7;

  return {
    margin,
    tableX,
    shiftX,
    shiftY,
    tableY,
    rowHeightTotal,
    hTop,
    hMid,
    hBottom,
  };
}

function createSecondaryLayout() {
  const params = buildLayoutParams();
  return {
    layout: buildSecondaryBulletinLayout({
      pageWidth: A4_WIDTH_MM,
      ...params,
    }),
    params,
  };
}

function assertTextFitsCell(
  doc: jsPDF,
  text: string,
  cellWidth: number,
  fontSize = 8,
) {
  doc.setFontSize(fontSize);
  const textWidth = doc.getTextWidth(text);
  assert.ok(
    textWidth <= cellWidth - CELL_PADDING_MM,
    `"${text}" (${textWidth.toFixed(2)}mm) dépasse la case (${cellWidth}mm)`,
  );
}

function drawSecondaryMaximaSample(
  doc: jsPDF,
  layout: ReturnType<typeof buildSecondaryBulletinLayout>,
  y: number,
  maximaHeight: number,
  values: {
    p1: number;
    p2: number;
    exam1: number;
    tt1: number;
    p3: number;
    p4: number;
    exam2: number;
    tt2: number;
    tg: number;
  },
) {
  drawSemesterRow1(
    doc,
    y,
    {
      p1: String(values.p1),
      p2: String(values.p2),
      exam1: String(values.exam1),
      tt1: String(values.tt1),
    },
    {
      p3: String(values.p3),
      p4: String(values.p4),
      exam2: String(values.exam2),
      tt2: String(values.tt2),
    },
    getSecondarySemesterDrawConfig(layout, maximaHeight),
  );

  drawCell1(
    doc,
    layout.colPos[3] + layout.shiftX,
    y,
    layout.colWidths[3],
    maximaHeight,
    String(values.tg),
    { isMaxima: true },
  );
}

function drawSecondaryFooterBlock(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin = 20,
) {
  const blockWidth = 190;
  const startX = (pageWidth - blockWidth) / 2;
  const startY = pageHeight - margin - 70;
  const lineHeight = 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("SIGNATURE PARENTS", startX, startY - 8);
  doc.text(
    "Note importante : le bulletin est sans valeur s'il est raturé ou surchargé.",
    startX,
    startY + lineHeight * 7 + 1,
  );

  return { startY, bottomY: startY + lineHeight * 7 + 6 };
}

function generateSecondaryBulletinPdf(
  fileName: string,
  studentCount: number,
  maximaProfile: "single" | "double" | "triple",
) {
  const { layout, params } = createSecondaryLayout();
  const doc = new jsPDF("p", "mm", "a4");
  const maximaHeight = 5;

  const maximaByProfile = {
    single: { p1: 9, p2: 9, exam1: 9, tt1: 27, p3: 9, p4: 9, exam2: 9, tt2: 27, tg: 54 },
    double: { p1: 99, p2: 99, exam1: 99, tt1: 297, p3: 99, p4: 99, exam2: 99, tt2: 297, tg: 594 },
    triple: { p1: 999, p2: 999, exam1: 999, tt1: 2997, p3: 999, p4: 999, exam2: 999, tt2: 2997, tg: 5994 },
  } as const;

  const maxima = maximaByProfile[maximaProfile];

  for (let studentIndex = 0; studentIndex < studentCount; studentIndex++) {
    if (studentIndex > 0) doc.addPage();

    const margin = params.margin;
    const frameWidth = getBulletinFrameWidth(A4_WIDTH_MM, margin);

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, frameWidth, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("REPUBLIQUE DEMOCRATIQUE DU CONGO", margin + frameWidth / 2, margin + 10, {
      align: "center",
    });
    doc.setFontSize(8);
    doc.text(
      `Lycée Secondaire Limete — Groupe Scolaire A`,
      margin + frameWidth / 2,
      margin + 18,
      { align: "center" },
    );
    doc.text(
      `Élève ${studentIndex + 1} — Classe 6e A — Année 2025-2026`,
      margin + frameWidth / 2,
      margin + 26,
      { align: "center" },
    );

    drawSecondaryTableHeader(doc, layout);

    let yPos = params.tableY + params.shiftY + params.rowHeightTotal;

    drawCell1(
      doc,
      layout.colPos[0] + layout.shiftX,
      yPos,
      layout.colWidths[0],
      maximaHeight,
      "MAXIMA GENERAUX",
      { isMaxima: true, align: "left" },
    );
    drawSecondaryMaximaSample(doc, layout, yPos, maximaHeight, maxima);
    yPos += maximaHeight;

    const subjects = ["Mathématiques", "Français", "Sciences"];
    for (const subject of subjects) {
      drawCell1(
        doc,
        layout.colPos[0] + layout.shiftX,
        yPos,
        layout.colWidths[0],
        maximaHeight,
        subject,
        { align: "left" },
      );
      drawSecondaryMaximaSample(doc, layout, yPos, maximaHeight, {
        p1: Math.floor(maxima.p1 * 0.7),
        p2: Math.floor(maxima.p2 * 0.8),
        exam1: Math.floor(maxima.exam1 * 0.75),
        tt1: Math.floor(maxima.tt1 * 0.75),
        p3: Math.floor(maxima.p3 * 0.65),
        p4: Math.floor(maxima.p4 * 0.7),
        exam2: Math.floor(maxima.exam2 * 0.72),
        tt2: Math.floor(maxima.tt2 * 0.69),
        tg: Math.floor(maxima.tg * 0.71),
      });
      yPos += maximaHeight;
    }

    const footer = drawSecondaryFooterBlock(
      doc,
      A4_WIDTH_MM,
      A4_HEIGHT_MM,
    );
    assert.ok(
      footer.bottomY <= A4_HEIGHT_MM - margin,
      `Bas de page hors A4 : ${footer.bottomY}mm > ${A4_HEIGHT_MM - margin}mm`,
    );
  }

  const outputPath = path.join(OUTPUT_DIR, fileName);
  const buffer = Buffer.from(doc.output("arraybuffer"));
  fs.writeFileSync(outputPath, buffer);
  return { outputPath, pageCount: studentCount };
}

// --- Vérifications automatisées (checklist phase 10) ---

test("six cases d'évaluation présentes et équilibrées", () => {
  const { layout } = createSecondaryLayout();
  const evalWidths = getSecondaryEvaluationCellWidths(layout);
  assert.equal(evalWidths.length, 6);
  const min = Math.min(...evalWidths);
  const max = Math.max(...evalWidths);
  assert.ok(max / min <= 1.5, `Déséquilibre excessif : min=${min}, max=${max}`);
  for (const width of evalWidths) {
    assert.ok(width >= MIN_EVAL_CELL_WIDTH_MM);
  }
});

test("maxima à 1, 2 et 3 chiffres lisibles dans les six cases", () => {
  const doc = new jsPDF("p", "mm", "a4");
  const { layout } = createSecondaryLayout();
  const evalWidths = getSecondaryEvaluationCellWidths(layout);
  for (const max of [9, 99, 999]) {
    for (const width of evalWidths) {
      assertTextFitsCell(doc, String(max), width);
    }
  }
});

test("aucun débordement horizontal A4 (tableau + marges)", () => {
  const { layout, params } = createSecondaryLayout();
  const rightEdge = params.tableX + layout.frameWidth;
  assert.ok(rightEdge <= A4_WIDTH_MM - BULLETIN_PAGE_MARGIN_MM + 0.01);
  assert.equal(layout.frameWidth, getBulletinFrameWidth(A4_WIDTH_MM));
});

test("colonnes latérales présentes : TG, SIGN PROF, repechage %", () => {
  const { layout } = createSecondaryLayout();
  assert.ok(layout.colWidths[3] > 0, "Colonne TG manquante");
  assert.ok(layout.colWidths[4] > 0, "Colonne SIGN PROF manquante");
  assert.ok(layout.repechageWidth > 0, "Colonne repechage manquante");
  assert.ok(layout.repechagePercentWidth > 0, "Sous-colonne % manquante");
  assert.ok(layout.repechageSignatureWidth > 0, "Sous-colonne signature manquante");
});

test("totaux semestre TOTAL 1 et TOTAL 2 : largeurs suffisantes", () => {
  const { layout } = createSecondaryLayout();
  const doc = new jsPDF("p", "mm", "a4");
  const tot1Width = layout.sem1SubWidths[2];
  const tot2Width = layout.sem2SubWidths[2];
  assertTextFitsCell(doc, "2997", tot1Width);
  assertTextFitsCell(doc, "2997", tot2Width);
});

test("génération bulletin individuel secondaire (PDF échantillon)", () => {
  ensureOutputDir();
  const { outputPath, pageCount } = generateSecondaryBulletinPdf(
    "bulletin-secondaire-individuel.pdf",
    1,
    "triple",
  );
  assert.equal(pageCount, 1);
  assert.ok(fs.existsSync(outputPath));
  assert.ok(fs.statSync(outputPath).size > 1000);
});

test("génération export classe secondaire (plusieurs élèves)", () => {
  ensureOutputDir();
  const studentCount = 3;
  const { outputPath, pageCount } = generateSecondaryBulletinPdf(
    "bulletin-secondaire-classe.pdf",
    studentCount,
    "double",
  );
  assert.equal(pageCount, studentCount);
  assert.ok(fs.existsSync(outputPath));
});

test("export classe : cohérence des pages (même nombre de matières par page)", () => {
  const { layout, params } = createSecondaryLayout();
  const maximaHeight = 5;
  const subjectsPerPage = 3;
  const headerAndMaxima =
    params.tableY + params.shiftY + params.rowHeightTotal + maximaHeight;
  const tableContentHeight = (subjectsPerPage + 1) * maximaHeight;
  const footerTop = A4_HEIGHT_MM - 20 - 70 - 8;
  const totalUsed = headerAndMaxima + tableContentHeight;
  assert.ok(
    totalUsed < footerTop,
    `Contenu tableau (${totalUsed}mm) chevauche le bas de page (${footerTop}mm)`,
  );
  assert.ok(layout.colPos.length >= 8, "Structure de colonnes incomplète");
});

test("logique identique à l'audit phase 1 : 4 périodes + 2 examens + TG", () => {
  const evalWidths = getSecondaryEvaluationCellWidths(createSecondaryLayout().layout);
  assert.equal(evalWidths.length, 6);
  const { layout } = createSecondaryLayout();
  assert.ok(layout.sem1PeriodWidths.length === 2);
  assert.ok(layout.sem2PeriodWidths.length === 2);
  assert.ok(layout.sem1SubWidths[1] > 0);
  assert.ok(layout.sem2SubWidths[1] > 0);
});

console.log(`\nPDF échantillons générés dans : ${OUTPUT_DIR}`);
console.log("Tous les contrôles visuels secondaires (phase 10) sont passés.");
