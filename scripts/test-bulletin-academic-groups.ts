import assert from "node:assert/strict";

import {
  areAllAcademicGroupsComplete,
  buildPeriodFieldMap,
  getAcademicStructure,
  getGroupPeriodOrder,
  getStorageGroupKey,
  isAcademicGroupComplete,
} from "../lib/academic-structure";
import {
  buildPeriodKeyDefinitions,
  buildSemOrder,
  canShowGroupTotal,
  canShowPeriodInGroup,
  computeGroupTotal,
} from "../lib/types";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("secondaire : 2 groupes académiques", () => {
  assert.equal(getAcademicStructure("SECONDAIRE").groups.length, 2);
});

test("primaire : 3 groupes académiques", () => {
  assert.equal(getAcademicStructure("PRIMAIRE").groups.length, 3);
});

test("ordre des périodes dérivé de la structure", () => {
  assert.deepEqual(getGroupPeriodOrder("SECONDAIRE", 1), [
    "p1",
    "p2",
    "exam1",
    "tt1",
  ]);
  assert.deepEqual(getGroupPeriodOrder("PRIMAIRE", 3), [
    "p5",
    "p6",
    "exam3",
    "tt3",
  ]);
});

test("SEM_ORDER secondaire conservé", () => {
  assert.deepEqual(buildSemOrder("SECONDAIRE").sem1, [
    "p1",
    "p2",
    "exam1",
    "tt1",
  ]);
});

test("periodKeyDefinitions primaire inclut sem3", () => {
  const definitions = buildPeriodKeyDefinitions("PRIMAIRE");
  assert.equal(definitions.p5, "sem3");
  assert.equal(definitions.exam3, "sem3");
});

test("periodFieldMap couvre les alias de périodes", () => {
  const map = buildPeriodFieldMap("SECONDAIRE");
  assert.deepEqual(map["1st Period"], { storageKey: "sem1", field: "p1" });
  assert.deepEqual(map["3tr Period"], { storageKey: "sem2", field: "p3" });
});

test("complétude d'un groupe académique", () => {
  const group = getAcademicStructure("SECONDAIRE").groups[0];
  const complete = isAcademicGroupComplete(
    [
      { periodName: "1ere Periode" },
      { periodName: "2e Periode" },
      { periodName: "Examen 1er semestre" },
    ],
    group,
  );

  assert.equal(complete, true);
});

test("complétude annuelle secondaire", () => {
  const periods = [
    { periodName: "1ere Periode" },
    { periodName: "2e Periode" },
    { periodName: "Examen 1er semestre" },
    { periodName: "3e Periode" },
    { periodName: "4e Periode" },
    { periodName: "Examen 2e semestre" },
  ];

  assert.equal(areAllAcademicGroupsComplete(periods, "SECONDAIRE"), true);
  assert.equal(areAllAcademicGroupsComplete(periods, "PRIMAIRE"), false);
});

test("visibilité des totaux de groupe", () => {
  assert.equal(canShowGroupTotal(1, ["exam1"], "SECONDAIRE"), true);
  assert.equal(canShowGroupTotal(1, ["p3"], "SECONDAIRE"), true);
  assert.equal(canShowGroupTotal(2, ["exam2"], "SECONDAIRE"), true);
  assert.equal(canShowGroupTotal(3, ["exam3"], "PRIMAIRE"), true);
});

test("calcul générique d'un total de groupe", () => {
  const subject = {
    name: "Math",
    sem1: { p1: 10, p2: 8, exam1: 18 },
    sem2: { p3: 0, p4: 0, exam2: 0 },
    baseMaxScore: 10,
  };

  assert.equal(
    computeGroupTotal(subject, 1, ["p1", "p2", "exam1"], "SECONDAIRE"),
    36,
  );
});

test("clés de stockage alignées sur l'ordre des groupes", () => {
  const primaryGroups = getAcademicStructure("PRIMAIRE").groups;
  assert.equal(getStorageGroupKey(primaryGroups[2]), "sem3");
});

console.log("\n11 tests des groupes académiques réussis.");
