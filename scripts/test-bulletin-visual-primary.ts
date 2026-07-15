/**
 * Phase 11 — Contrôle visuel bulletin primaire.
 * Génère des PDF d'échantillon et vérifie les contraintes de mise en page A4 portrait.
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
  buildPrimaryBulletinLayout,
  drawPrimaryTableHeader,
  drawPrimaryTrimesterMaximaRow,
  getPrimaryEvaluationCellWidths,
  MIN_EVAL_CELL_WIDTH_MM,
  PRIMARY_MIN_EVAL_CELL_WIDTH_MM,
  PRIMARY_MIN_MAX_CELL_WIDTH_MM,
  PRIMARY_MIN_PERIOD_CELL_WIDTH_MM,
} from "../app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/bulletin-primary-layout";
import {
  buildSecondaryBulletinLayout,
} from "../app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/bulletin-secondary-layout";
import { drawCell1 } from "../lib/types";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const OUTPUT_DIR = path.join("context", "samples", "phase-11");
const CELL_PADDING_MM = 2;

function minWidthForPrimaryCell(kind: string): number {
  if (kind === "period-score") return PRIMARY_MIN_PERIOD_CELL_WIDTH_MM;
  if (kind.startsWith("max-")) return PRIMARY_MIN_MAX_CELL_WIDTH_MM;
  return PRIMARY_MIN_EVAL_CELL_WIDTH_MM;
}

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
  const rowHeightTotal = 14;
  const hTop = 8;
  const hMid = 6;
  const hBottom = 0;

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

function createPrimaryLayout() {
  const params = buildLayoutParams();
  return {
    layout: buildPrimaryBulletinLayout({
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
  paddingMm = CELL_PADDING_MM,
) {
  doc.setFontSize(fontSize);
  const textWidth = doc.getTextWidth(text);
  assert.ok(
    textWidth <= cellWidth - paddingMm,
    `"${text}" (${textWidth.toFixed(2)}mm) dépasse la case (${cellWidth}mm)`,
  );
}

type PrimaryMaximaProfile = {
  p1: number;
  p2: number;
  exam1: number;
  tt1: number;
  p3: number;
  p4: number;
  exam2: number;
  tt2: number;
  p5: number;
  p6: number;
  exam3: number;
  tt3: number;
  maxAnnuel: number;
};

function drawPrimaryFooterBlock(
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

function generatePrimaryBulletinPdf(
  fileName: string,
  studentCount: number,
  maximaProfile: "single" | "double" | "triple",
) {
  const { layout, params } = createPrimaryLayout();
  const doc = new jsPDF("p", "mm", "a4");
  const maximaHeight = 5;

  const maximaByProfile = {
    single: {
      p1: 9, p2: 9, exam1: 18, tt1: 36,
      p3: 9, p4: 9, exam2: 18, tt2: 36,
      p5: 9, p6: 9, exam3: 18, tt3: 36,
      maxAnnuel: 108,
    },
    double: {
      p1: 99, p2: 99, exam1: 198, tt1: 396,
      p3: 99, p4: 99, exam2: 198, tt2: 396,
      p5: 99, p6: 99, exam3: 198, tt3: 396,
      maxAnnuel: 1188,
    },
    triple: {
      p1: 999, p2: 999, exam1: 1998, tt1: 3996,
      p3: 999, p4: 999, exam2: 1998, tt2: 3996,
      p5: 999, p6: 999, exam3: 1998, tt3: 3996,
      maxAnnuel: 11988,
    },
  } as const satisfies Record<string, PrimaryMaximaProfile>;

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
      `École Primaire Limete — Groupe Scolaire A`,
      margin + frameWidth / 2,
      margin + 18,
      { align: "center" },
    );
    doc.text(
      `Élève ${studentIndex + 1} — Classe 5e A — Année 2025-2026`,
      margin + frameWidth / 2,
      margin + 26,
      { align: "center" },
    );

    drawPrimaryTableHeader(doc, layout);

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
    drawPrimaryTrimesterMaximaRow(doc, yPos, maxima, layout, maximaHeight);
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
      drawPrimaryTrimesterMaximaRow(doc, yPos, {
        p1: Math.floor(maxima.p1 * 0.7),
        p2: Math.floor(maxima.p2 * 0.8),
        exam1: Math.floor(maxima.exam1 * 0.75),
        tt1: Math.floor(maxima.tt1 * 0.75),
        p3: Math.floor(maxima.p3 * 0.65),
        p4: Math.floor(maxima.p4 * 0.7),
        exam2: Math.floor(maxima.exam2 * 0.72),
        tt2: Math.floor(maxima.tt2 * 0.69),
        p5: Math.floor(maxima.p5 * 0.68),
        p6: Math.floor(maxima.p6 * 0.71),
        exam3: Math.floor(maxima.exam3 * 0.73),
        tt3: Math.floor(maxima.tt3 * 0.7),
        maxAnnuel: Math.floor(maxima.maxAnnuel * 0.71),
      }, layout, maximaHeight);
      yPos += maximaHeight;
    }

    const footer = drawPrimaryFooterBlock(doc, A4_WIDTH_MM, A4_HEIGHT_MM);
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

// --- Vérifications automatisées (checklist phase 11) ---

test("21 cases d'évaluation présentes (grille primaire v2)", () => {
  const { layout } = createPrimaryLayout();
  assert.equal(layout.evalCells.length, 21);
  for (const cell of layout.evalCells) {
    assert.ok(cell.width >= minWidthForPrimaryCell(cell.kind));
  }
});

test("maxima à 1, 2 et 3 chiffres lisibles dans les cases", () => {
  const doc = new jsPDF("p", "mm", "a4");
  const { layout } = createPrimaryLayout();
  for (const max of [9, 99, 999]) {
    for (const cell of layout.evalCells) {
      if (cell.kind === "period-score") continue;
      const isMax = cell.kind.startsWith("max-");
      const fontSize = isMax ? 5 : 8;
      const padding = isMax ? 0.5 : CELL_PADDING_MM;
      assertTextFitsCell(doc, String(max), cell.width, fontSize, padding);
    }
  }
});

test("colonnes MAX TRIM et TOTAL : largeurs suffisantes", () => {
  const { layout } = createPrimaryLayout();
  const doc = new jsPDF("p", "mm", "a4");
  const trimCells = layout.evalCells.filter((c) => c.kind === "max-trim" || c.kind === "pts-trim");
  assert.equal(trimCells.length, 6);
  for (const cell of trimCells) {
    assertTextFitsCell(doc, "999", cell.width, 6);
  }
});

test("colonne finale TOTAL (MAX | PTS OBT)", () => {
  const { layout } = createPrimaryLayout();
  const doc = new jsPDF("p", "mm", "a4");
  assert.ok(layout.finalMaxWidth > 0);
  assert.ok(layout.finalPtsWidth > 0);
  assertTextFitsCell(doc, "9999", layout.finalMaxWidth, 6);
});

test("aucun débordement horizontal A4 (tableau + marges)", () => {
  const { layout, params } = createPrimaryLayout();
  const rightEdge = params.tableX + layout.frameWidth;
  assert.ok(rightEdge <= A4_WIDTH_MM - BULLETIN_PAGE_MARGIN_MM + 0.01);
  assert.equal(layout.frameWidth, getBulletinFrameWidth(A4_WIDTH_MM));
});

test("colonne TOTAL en fin de tableau (sans SIGN PROF ni repechage)", () => {
  const { layout } = createPrimaryLayout();
  assert.ok(layout.colWidths[4] > 0, "Colonne TOTAL manquante");
  assert.equal(layout.colWidths.length, 5);
});

test("trois groupes trimestriels : structure 21 cellules", () => {
  const { layout } = createPrimaryLayout();
  assert.equal(layout.evalCells.filter((c) => c.trimesterIndex === 1).length, 7);
  assert.equal(layout.evalCells.filter((c) => c.trimesterIndex === 2).length, 6);
  assert.equal(layout.evalCells.filter((c) => c.trimesterIndex === 3).length, 6);
});

test("identité visuelle alignée sur le secondaire (marges, frame, min case)", () => {
  const primary = createPrimaryLayout().layout;
  const secondary = buildSecondaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  assert.equal(primary.frameWidth, secondary.frameWidth);
  assert.equal(getBulletinFrameWidth(A4_WIDTH_MM), 190);
  for (const cell of primary.evalCells) {
    assert.ok(cell.width >= minWidthForPrimaryCell(cell.kind));
  }
});

test("génération bulletin individuel primaire (PDF échantillon)", () => {
  ensureOutputDir();
  const { outputPath, pageCount } = generatePrimaryBulletinPdf(
    "bulletin-primaire-individuel.pdf",
    1,
    "triple",
  );
  assert.equal(pageCount, 1);
  assert.ok(fs.existsSync(outputPath));
  assert.ok(fs.statSync(outputPath).size > 1000);
});

test("génération export classe primaire (plusieurs élèves)", () => {
  ensureOutputDir();
  const studentCount = 3;
  const { outputPath, pageCount } = generatePrimaryBulletinPdf(
    "bulletin-primaire-classe.pdf",
    studentCount,
    "double",
  );
  assert.equal(pageCount, studentCount);
  assert.ok(fs.existsSync(outputPath));
});

test("export classe : cohérence des pages (pas de chevauchement bas de page)", () => {
  const { layout, params } = createPrimaryLayout();
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
  assert.equal(layout.colPos.length, 6, "5 colonnes + position finale");
});

test("logique primaire v2 : 21 cellules + TOTAL (MAX | PTS OBT)", () => {
  const evalWidths = getPrimaryEvaluationCellWidths(createPrimaryLayout().layout);
  assert.equal(evalWidths.length, 21);
  const { layout } = createPrimaryLayout();
  assert.ok(layout.finalMaxX > 0);
  assert.ok(layout.finalPtsX > layout.finalMaxX);
});

console.log(`\nPDF échantillons générés dans : ${OUTPUT_DIR}`);
console.log("Tous les contrôles visuels primaires (phase 11) sont passés.");
