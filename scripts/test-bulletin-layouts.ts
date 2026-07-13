import assert from "node:assert/strict";

import { getBulletinFrameWidth } from "../lib/bulletin-layout";
import {
  buildPrimaryBulletinLayout,
  getPrimaryEvaluationCellWidths,
  PRIMARY_MAIN_COL_RATIOS,
} from "../app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/bulletin-primary-layout";
import {
  buildSecondaryBulletinLayout,
  getSecondaryEvaluationCellWidths,
  MIN_EVAL_CELL_WIDTH_MM,
  SECONDARY_MAIN_COL_RATIOS,
  SECONDARY_REPECHAGE_WIDTH_MM,
} from "../app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/bulletin-secondary-layout";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const A4_WIDTH_MM = 210;

test("frameWidth calculé depuis la largeur A4", () => {
  assert.equal(getBulletinFrameWidth(A4_WIDTH_MM), 190);
});

test("secondaire : largeurs comme ef2d740 (ratios non normalisés, somme 90 %)", () => {
  const layout = buildSecondaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  const ratioSum = SECONDARY_MAIN_COL_RATIOS.reduce((sum, ratio) => sum + ratio, 0);
  const total = layout.colWidths.reduce((sum, width) => sum + width, 0);
  assert.ok(Math.abs(ratioSum - 0.9) < 0.001);
  assert.ok(Math.abs(total - ratioSum * layout.frameWidth) < 0.01);
  assert.ok(Math.abs(total - layout.frameWidth) > 1, "Ne doit pas normaliser à 100 %");
});

test("positions X dérivées des largeurs, pas de coordonnées fixes", () => {
  const layout = buildSecondaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  assert.equal(
    layout.totX1,
    layout.colPos[1] + layout.shiftX + layout.sem1SubWidths[0],
  );
  assert.equal(layout.examX1, layout.totX1 + layout.sem1SubWidths[1]);
  assert.equal(
    layout.totX2,
    layout.colPos[2] + layout.shiftX + layout.sem2SubWidths[0],
  );
  assert.equal(layout.examX2, layout.totX2 + layout.sem2SubWidths[1]);
});

test("six cases d'évaluation présentes et rééquilibrées", () => {
  const layout = buildSecondaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  const evalWidths = getSecondaryEvaluationCellWidths(layout);
  assert.equal(evalWidths.length, 6);
  for (const width of evalWidths) {
    assert.ok(
      width >= MIN_EVAL_CELL_WIDTH_MM,
      `Case trop étroite : ${width}mm < ${MIN_EVAL_CELL_WIDTH_MM}mm`,
    );
  }
});

test("maxima à 1, 2 et 3 chiffres : largeur suffisante", () => {
  const layout = buildSecondaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  const evalWidths = getSecondaryEvaluationCellWidths(layout);
  const sampleMaxima = [9, 99, 999];
  for (const max of sampleMaxima) {
    const digits = String(max).length;
    const minRequired = digits <= 1 ? 6 : digits === 2 ? 7.5 : MIN_EVAL_CELL_WIDTH_MM;
    for (const width of evalWidths) {
      assert.ok(
        width >= minRequired,
        `Max ${max} (${digits} chiffres) : ${width}mm < ${minRequired}mm`,
      );
    }
  }
});

test("colonne repechage fixée à 34.1 mm (ef2d740)", () => {
  const layout = buildSecondaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  assert.equal(layout.repechageWidth, SECONDARY_REPECHAGE_WIDTH_MM);
  assert.equal(layout.repechageWidth, 34.1);
  assert.equal(layout.spacerWidth, 4);
  assert.ok(
    Math.abs(
      layout.repechagePercentWidth + layout.repechageSignatureWidth -
        layout.repechageWidth,
    ) < 0.01,
  );
});

test("ratios principaux inchangés en nombre de colonnes", () => {
  assert.equal(SECONDARY_MAIN_COL_RATIOS.length, 7);
});

console.log("\nTous les tests layout secondaire sont passés.");

test("primaire : colonnes principales couvrent toute la largeur utile", () => {
  const layout = buildPrimaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  const total = layout.colWidths.reduce((sum, width) => sum + width, 0);
  assert.ok(Math.abs(total - layout.frameWidth) < 0.01);
});

test("primaire : positions X dérivées des largeurs", () => {
  const layout = buildPrimaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  for (const trim of [layout.trim1, layout.trim2, layout.trim3]) {
    assert.equal(trim.examX, trim.totX + trim.subWidths[1]);
  }
  assert.equal(
    layout.trim1.totX,
    layout.colPos[1] + layout.shiftX + layout.trim1.subWidths[0],
  );
  assert.equal(
    layout.trim2.totX,
    layout.colPos[2] + layout.shiftX + layout.trim2.subWidths[0],
  );
  assert.equal(
    layout.trim3.totX,
    layout.colPos[3] + layout.shiftX + layout.trim3.subWidths[0],
  );
});

test("primaire : neuf cases d'évaluation (6 périodes + 3 examens)", () => {
  const layout = buildPrimaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  const evalWidths = getPrimaryEvaluationCellWidths(layout);
  assert.equal(evalWidths.length, 9);
  for (const width of evalWidths) {
    assert.ok(
      width >= MIN_EVAL_CELL_WIDTH_MM,
      `Case trop étroite : ${width}mm < ${MIN_EVAL_CELL_WIDTH_MM}mm`,
    );
  }
});

test("primaire : trois totaux trimestriels présents", () => {
  const layout = buildPrimaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  for (const trim of [layout.trim1, layout.trim2, layout.trim3]) {
    assert.ok(trim.subWidths[2] > 0, "Largeur TOTAL trimestre manquante");
  }
});

test("primaire : colonne TG distincte", () => {
  const layout = buildPrimaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  assert.ok(layout.colWidths[4] > 0);
  assert.equal(layout.colPos[4], layout.colPos[3] + layout.colWidths[3]);
});

test("primaire : maxima à 1, 2 et 3 chiffres — largeur suffisante", () => {
  const layout = buildPrimaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  const evalWidths = getPrimaryEvaluationCellWidths(layout);
  const sampleMaxima = [9, 99, 999];
  for (const max of sampleMaxima) {
    const digits = String(max).length;
    const minRequired = digits <= 1 ? 6 : digits === 2 ? 7.5 : MIN_EVAL_CELL_WIDTH_MM;
    for (const width of evalWidths) {
      assert.ok(
        width >= minRequired,
        `Max ${max} (${digits} chiffres) : ${width}mm < ${minRequired}mm`,
      );
    }
  }
});

test("primaire : ratios principaux — 5 colonnes (COURS + 3 trimestres + TG)", () => {
  assert.equal(PRIMARY_MAIN_COL_RATIOS.length, 5);
});

test("primaire : pas de colonnes SIGN PROF / repechage", () => {
  const layout = buildPrimaryBulletinLayout({ pageWidth: A4_WIDTH_MM });
  assert.equal(layout.colWidths.length, 5);
  assert.equal(layout.colPos.length, 6);
});

console.log("\nTous les tests layout primaire sont passés.");
