import assert from "node:assert/strict";

import {
  getAcademicPeriodKey,
  getAcademicStructure,
} from "../lib/academic-structure";
import { listSecondaryPeriodOptions } from "../lib/atelier-course-link";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("periodes secondaires listables pour association atelier", () => {
  const periods = listSecondaryPeriodOptions("CONGOLAIS");
  assert.ok(periods.length >= 6);
  assert.ok(periods.some((p) => p.key === "p1"));
  assert.ok(periods.some((p) => p.key === "exam1" || p.label.includes("Examen")));
});

test("cle periode secondaire resolue depuis le label fiche", () => {
  const structure = getAcademicStructure("SECONDAIRE", "CONGOLAIS");
  const first = structure.periods[0];
  assert.ok(first);
  const key = getAcademicPeriodKey(first.label, "SECONDAIRE", "CONGOLAIS");
  assert.equal(key, first.key);
});

console.log("atelier-course-link period mapping OK");
