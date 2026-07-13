import assert from "node:assert/strict";

import {
  buildEmptySubjectGroupScores,
  buildPeriodFieldMap,
  getActivePeriodKeys,
} from "../lib/academic-structure";
import {
  computeGroupTotal,
  mapTypeFicheSectionToSubject,
  type TypeFiche,
} from "../lib/types";
import {
  calculateBulletinPercentage,
  calculateBulletinYearMaxima,
} from "../lib/bulletin-maxima";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("TotalKey tt3 reconnu dans les types primaires", () => {
  const section = mapTypeFicheSectionToSubject(
    {
      sem1: { tt1: "100" },
      sem2: { tt2: "200" },
      sem3: { tt3: "150", tg: "450" },
    },
    "TOTAUX",
  );

  assert.equal(section.sem3?.tt3, 150);
  assert.equal(section.sem3?.tg, 450);
});

test("primaire : total1 + total2 + total3 = total général", () => {
  const subject = {
    name: "Math",
    sem1: { p1: 10, p2: 10, exam1: 20 },
    sem2: { p3: 8, p4: 8, exam2: 16 },
    sem3: { p5: 9, p6: 9, exam3: 18 },
    baseMaxScore: 10,
  };

  const activeKeys = getActivePeriodKeys("Examen 3e trimestre", "PRIMAIRE");
  const tt1 = computeGroupTotal(subject, 1, activeKeys, "PRIMAIRE");
  const tt2 = computeGroupTotal(subject, 2, activeKeys, "PRIMAIRE");
  const tt3 = computeGroupTotal(subject, 3, activeKeys, "PRIMAIRE");

  assert.equal(tt1, 40);
  assert.equal(tt2, 32);
  assert.equal(tt3, 36);
  assert.equal(tt1 + tt2 + tt3, 108);
});

test("secondaire : fiche sans 3e trimestre reste valide", () => {
  const emptyScores = buildEmptySubjectGroupScores("SECONDAIRE");
  assert.ok(emptyScores.sem1);
  assert.ok(emptyScores.sem2);
  assert.equal(emptyScores.sem3, undefined);

  const legacyFiche: TypeFiche = {
    TOTAUX: {
      sem1: { p1: "10", tt1: "30" },
      sem2: { p3: "8", tt2: "24" },
    },
    POURCENTAGES: { sem1: {}, sem2: {} },
    "PLACE/NOMBRE D'ELEVES": { sem1: {}, sem2: {} },
    APPLICATIONS: { sem1: {}, sem2: {} },
    CONDUITE: { sem1: {}, sem2: {} },
    "SIGNATURE PARENTS": { sem1: {}, sem2: {} },
  };

  const subject = mapTypeFicheSectionToSubject(legacyFiche.TOTAUX, "TOTAUX");
  assert.equal(subject.sem3, undefined);
  assert.equal(subject.sem1.tt1, 30);
  assert.equal(subject.sem2.tt2, 24);
});

test("période manquante : pas de NaN ni division par zéro", () => {
  assert.equal(calculateBulletinPercentage(50, 0), 0);
  assert.equal(calculateBulletinPercentage(NaN, 100), 0);
  assert.equal(
    computeGroupTotal(
      {
        name: "Fr",
        sem1: { p1: 0, p2: 0, exam1: 0 },
        sem2: { p3: 0, p4: 0, exam2: 0 },
        baseMaxScore: 10,
      },
      1,
      ["p1"],
      "SECONDAIRE",
    ),
    0,
  );
});

test("periodFieldMap primaire couvre p5, p6 et exam3", () => {
  const map = buildPeriodFieldMap("PRIMAIRE");
  assert.deepEqual(map["5e Periode"], { storageKey: "sem3", field: "p5" });
  assert.deepEqual(map["6e Periode"], { storageKey: "sem3", field: "p6" });
  assert.deepEqual(map["Examen 3e trimestre"], {
    storageKey: "sem3",
    field: "exam3",
  });
});

test("getActivePeriodKeys primaire inclut les 9 périodes à l'examen final", () => {
  const keys = getActivePeriodKeys("Examen 3e trimestre", "PRIMAIRE");
  assert.deepEqual(keys, [
    "p1",
    "p2",
    "exam1",
    "p3",
    "p4",
    "exam2",
    "p5",
    "p6",
    "exam3",
  ]);
});

test("maxima annuels primaire : 3 groupes additionnés", () => {
  const year = calculateBulletinYearMaxima(
    {
      p1: 10,
      p2: 10,
      exam1: 20,
      p3: 10,
      p4: 10,
      exam2: 20,
      p5: 10,
      p6: 10,
      exam3: 20,
    },
    "PRIMAIRE",
  );

  assert.equal(year.groups.length, 3);
  assert.equal(year.groups[0]?.total, 40);
  assert.equal(year.groups[1]?.total, 40);
  assert.equal(year.groups[2]?.total, 40);
  assert.equal(year.annualTotal, 120);
});

console.log("\n7 tests des données étendues réussis.");
