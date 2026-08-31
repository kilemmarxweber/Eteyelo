import assert from "node:assert/strict";

import {
  getAcademicStructure,
  resolveAcademicPeriodConfig,
} from "../lib/academic-structure";
import { resolveBulletinLayoutKind } from "../lib/bulletin-context";
import { usesTermPeriodCalendar } from "../lib/education-system";
import { numberToWords } from "../lib/number-to-words";

function test(name: string, run: () => void) {
  run();
  console.log(`✓ ${name}`);
}

test("Congolais primaire : 9 évaluations", () => {
  assert.equal(getAcademicStructure("PRIMAIRE").periods.length, 9);
  assert.equal(getAcademicStructure("PRIMAIRE", "CONGOLAIS").periods.length, 9);
});

test("Congolais secondaire : 6 évaluations", () => {
  assert.equal(getAcademicStructure("SECONDAIRE").periods.length, 6);
});

test("Angolais primaire et secondaire : 3 périodes", () => {
  const primary = getAcademicStructure("PRIMAIRE", "ANGOLAIS");
  const secondary = getAcademicStructure("SECONDAIRE", "ANGOLAIS");
  assert.equal(primary.periods.length, 3);
  assert.equal(secondary.periods.length, 3);
  assert.equal(primary.groups.length, 3);
  assert.ok(primary.groups.every((group) => group.periods.length === 1));
  assert.ok(primary.groups.every((group) => group.periods[0]?.kind === "PERIOD"));
  assert.equal(primary.periods[0]?.label, "1.ª Período");
});

test("Notes Angola : 1.ª Período reconnue seulement avec educationSystem", () => {
  assert.equal(
    resolveAcademicPeriodConfig(
      "1.ª Período",
      "SECONDAIRE",
      "1.º Trimestre",
      "ANGOLAIS",
    )?.label,
    "1.ª Período",
  );
  assert.equal(
    resolveAcademicPeriodConfig("1.ª Período", "SECONDAIRE", null, "CONGOLAIS"),
    null,
  );
});

test("Anglais : 3 terms / 3 periods", () => {
  const structure = getAcademicStructure("PRIMAIRE", "ANGLAIS");
  assert.equal(structure.periods.length, 3);
  assert.equal(structure.groups[0]?.label, "Term 1");
  assert.equal(structure.periods[0]?.label, "Period 1");
});

test("Université + Angolais : calendrier LMD inchangé", () => {
  assert.equal(usesTermPeriodCalendar("UNIVERSITE", "ANGOLAIS"), false);
  assert.equal(
    getAcademicStructure("UNIVERSITE", "ANGOLAIS").periods.length,
    getAcademicStructure("UNIVERSITE").periods.length,
  );
});

test("Bulletin Angola / Anglais : Angola Declaração (term-period), Anglais term-period", () => {
  assert.equal(resolveBulletinLayoutKind("PRIMAIRE"), "primary");
  assert.equal(resolveBulletinLayoutKind("SECONDAIRE"), "secondary");
  assert.equal(resolveBulletinLayoutKind("PRIMAIRE", "ANGOLAIS"), "term-period");
  assert.equal(resolveBulletinLayoutKind("SECONDAIRE", "ANGOLAIS"), "term-period");
  assert.equal(resolveBulletinLayoutKind("SECONDAIRE", "ANGLAIS"), "term-period");
});

test("Nombre en lettres PT / EN", () => {
  assert.equal(numberToWords(11, "pt"), "Onze");
  assert.equal(numberToWords(14, "pt"), "Catorze");
  assert.equal(numberToWords(11, "en"), "Eleven");
});

console.log("Education system tests passed.");
