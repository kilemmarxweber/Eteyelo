import assert from "node:assert/strict";

import { getAcademicStructure, normalizeAcademicPeriodLabel } from "../lib/academic-structure";
import {
  formatGlobalSemesterCode,
  formatUniversitySemesterLabel,
  getGlobalSemesterNumber,
  getSchoolYearDisplayLabel,
  getUniversityLmdGroups,
  LMD_SEMESTER_MATRIX,
} from "../lib/university-lmd";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("structure universite : calendrier LMD RDC (2 semestres)", () => {
  const structure = getAcademicStructure("UNIVERSITE");
  assert.equal(structure.groups.length, 2);
  assert.equal(structure.groups[0]?.label, "Premier semestre");
  assert.equal(structure.groups[1]?.label, "Deuxième semestre");
  assert.equal(structure.periods.length, 6);

  const sem1 = structure.groups[0]?.periods.map((period) => period.label) ?? [];
  assert.deepEqual(sem1, [
    "Cours",
    "Évaluations",
    "Première session",
  ]);

  const sem2 = structure.groups[1]?.periods.map((period) => period.label) ?? [];
  assert.deepEqual(sem2, [
    "Cours",
    "Évaluations",
    "Deuxième session",
  ]);
});

test("numérotation globale LMD", () => {
  assert.equal(getGlobalSemesterNumber("L1", 1), 1);
  assert.equal(getGlobalSemesterNumber("L1", 2), 2);
  assert.equal(getGlobalSemesterNumber("L3", 1), 5);
  assert.equal(getGlobalSemesterNumber("M2", 2), 10);
  assert.equal(getGlobalSemesterNumber("Doctorat", 1), 11);
  assert.equal(formatGlobalSemesterCode("L2", 2), "S4");
});

test("libellés semestre avec code global", () => {
  assert.equal(
    formatUniversitySemesterLabel(1, "L3"),
    "Premier semestre (S5)",
  );
  assert.equal(formatUniversitySemesterLabel(2, "M1"), "Deuxième semestre (S8)");
  assert.equal(formatUniversitySemesterLabel(1), "Premier semestre");
});

test("matrice LMD documentée", () => {
  assert.equal(LMD_SEMESTER_MATRIX.length, 6);
  assert.deepEqual(LMD_SEMESTER_MATRIX[0]?.semesters, ["S1", "S2"]);
  assert.equal(getUniversityLmdGroups().length, 2);
});

test("libelle annee academique reserve a UNIVERSITE", () => {
  assert.equal(getSchoolYearDisplayLabel("UNIVERSITE"), "Année académique");
  assert.equal(getSchoolYearDisplayLabel("SECONDAIRE"), "Année scolaire");
  assert.equal(getSchoolYearDisplayLabel("PRIMAIRE"), "Année scolaire");
});

test("aliases periodes universite : compatibilite anciens libelles", () => {
  assert.equal(
    normalizeAcademicPeriodLabel("Examen (1re session — 1er semestre)"),
    "Première session",
  );
  assert.equal(
    normalizeAcademicPeriodLabel("2e session (Rattrapage)"),
    "Deuxième session",
  );
  assert.equal(
    normalizeAcademicPeriodLabel("Première session (examens ordinaires)"),
    "Première session",
  );
});

console.log("\nTous les tests calendrier LMD universite sont passes.");
