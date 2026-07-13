import assert from "node:assert/strict";

import { getActivePeriodKeys } from "../lib/academic-structure";
import {
  aggregateBulletinPeriodMaxima,
  calculateBulletinPercentage,
  calculateBulletinYearMaxima,
  getBulletinGroupMaxima,
  resolveBulletinMaxScore,
  type BulletinPeriodKey,
} from "../lib/bulletin-maxima";
import {
  computeGroupTotal,
  computeTotSem1,
  computeTotSem2,
  computeTotSem3,
  mapTypeFicheSectionToSubject,
  type Subject,
  type TypeFiche,
} from "../lib/types";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function buildDynamicCourseMaxima(
  ponderation: number,
  recorded?: Partial<Record<BulletinPeriodKey, number>>,
): Record<BulletinPeriodKey, number> {
  const keys: BulletinPeriodKey[] = [
    "p1",
    "p2",
    "exam1",
    "p3",
    "p4",
    "exam2",
    "p5",
    "p6",
    "exam3",
  ];

  return Object.fromEntries(
    keys.map((key) => {
      const recordedValue = recorded?.[key];
      const resolved = resolveBulletinMaxScore({
        recordedMaxScore: recordedValue,
        ponderation,
        isExam: key.startsWith("exam"),
      });

      return [key, resolved.value];
    }),
  ) as Record<BulletinPeriodKey, number>;
}

function assertNoNaN(value: number, label: string) {
  assert.ok(Number.isFinite(value), `${label} ne doit pas être NaN ni infini`);
}

// --- Secondaire ---

test("secondaire : 4 périodes (p1–p4) prises en compte dans les totaux", () => {
  const subject: Subject = {
    name: "Math",
    sem1: { p1: 10, p2: 8, exam1: 18 },
    sem2: { p3: 9, p4: 7, exam2: 16 },
    baseMaxScore: 10,
  };
  const active = getActivePeriodKeys("Examen 2e semestre", "SECONDAIRE");

  assert.equal(computeGroupTotal(subject, 1, active, "SECONDAIRE"), 36);
  assert.equal(computeGroupTotal(subject, 2, active, "SECONDAIRE"), 32);
});

test("secondaire : 2 examens (exam1, exam2) inclus dans les totaux de semestre", () => {
  const subject: Subject = {
    name: "Français",
    sem1: { p1: 5, p2: 5, exam1: 20 },
    sem2: { p3: 4, p4: 4, exam2: 16 },
    baseMaxScore: 10,
  };
  const active = getActivePeriodKeys("Examen 2e semestre", "SECONDAIRE");

  const tt1 = computeTotSem1(subject, active);
  const tt2 = computeTotSem2(subject, active);

  assert.equal(tt1, 30);
  assert.equal(tt2, 24);
});

test("secondaire : 2 totaux de semestre (TT1, TT2)", () => {
  const subject: Subject = {
    name: "Histoire",
    sem1: { p1: 7, p2: 6, exam1: 14 },
    sem2: { p3: 8, p4: 7, exam2: 15 },
    baseMaxScore: 10,
  };
  const active = getActivePeriodKeys("Examen 2e semestre", "SECONDAIRE");

  assert.equal(computeGroupTotal(subject, 1, active, "SECONDAIRE"), 27);
  assert.equal(computeGroupTotal(subject, 2, active, "SECONDAIRE"), 30);
});

test("secondaire : total général (TG) = TT1 + TT2", () => {
  const subject: Subject = {
    name: "Math",
    sem1: { p1: 10, p2: 8, exam1: 18 },
    sem2: { p3: 9, p4: 7, exam2: 16 },
    baseMaxScore: 10,
  };
  const active = getActivePeriodKeys("Examen 2e semestre", "SECONDAIRE");
  const tt1 = computeGroupTotal(subject, 1, active, "SECONDAIRE");
  const tt2 = computeGroupTotal(subject, 2, active, "SECONDAIRE");
  const tg = tt1 + tt2;

  assert.equal(tg, 68);
  assertNoNaN(tg, "TG secondaire");
});

test("secondaire : maxima dynamiques agrégés (jamais depuis un profil statique)", () => {
  const subjectsMaxima = [
    buildDynamicCourseMaxima(1),
    buildDynamicCourseMaxima(2),
    buildDynamicCourseMaxima(3),
  ];
  const aggregated = aggregateBulletinPeriodMaxima(subjectsMaxima);
  const year = calculateBulletinYearMaxima(aggregated, "SECONDAIRE");

  assert.equal(aggregated.p1, 60);
  assert.equal(aggregated.exam1, 120);
  assert.equal(getBulletinGroupMaxima(year, 1)?.total, 240);
  assert.equal(getBulletinGroupMaxima(year, 2)?.total, 240);
  assert.equal(year.annualTotal, 480);
});

// --- Primaire ---

test("primaire : 6 périodes (p1–p6) prises en compte dans les totaux", () => {
  const subject: Subject = {
    name: "Math",
    sem1: { p1: 10, p2: 10, exam1: 20 },
    sem2: { p3: 8, p4: 8, exam2: 16 },
    sem3: { p5: 9, p6: 9, exam3: 18 },
    baseMaxScore: 10,
  };
  const active = getActivePeriodKeys("Examen 3e trimestre", "PRIMAIRE");

  assert.equal(computeGroupTotal(subject, 1, active, "PRIMAIRE"), 40);
  assert.equal(computeGroupTotal(subject, 2, active, "PRIMAIRE"), 32);
  assert.equal(computeGroupTotal(subject, 3, active, "PRIMAIRE"), 36);
});

test("primaire : 3 examens (exam1–exam3) inclus dans les totaux trimestriels", () => {
  const subject: Subject = {
    name: "Français",
    sem1: { p1: 5, p2: 5, exam1: 20 },
    sem2: { p3: 4, p4: 4, exam2: 16 },
    sem3: { p5: 6, p6: 6, exam3: 24 },
    baseMaxScore: 10,
  };
  const active = getActivePeriodKeys("Examen 3e trimestre", "PRIMAIRE");

  assert.equal(computeTotSem1(subject, active), 30);
  assert.equal(computeTotSem2(subject, active), 24);
  assert.equal(computeTotSem3(subject, active), 36);
});

test("primaire : 3 totaux de trimestre (TT1, TT2, TT3)", () => {
  const subject: Subject = {
    name: "Sciences",
    sem1: { p1: 7, p2: 8, exam1: 15 },
    sem2: { p3: 6, p4: 7, exam2: 13 },
    sem3: { p5: 8, p6: 9, exam3: 17 },
    baseMaxScore: 10,
  };
  const active = getActivePeriodKeys("Examen 3e trimestre", "PRIMAIRE");

  const tt1 = computeGroupTotal(subject, 1, active, "PRIMAIRE");
  const tt2 = computeGroupTotal(subject, 2, active, "PRIMAIRE");
  const tt3 = computeGroupTotal(subject, 3, active, "PRIMAIRE");

  assert.equal(tt1, 30);
  assert.equal(tt2, 26);
  assert.equal(tt3, 34);
});

test("primaire : total général (TG) = TT1 + TT2 + TT3", () => {
  const subject: Subject = {
    name: "Math",
    sem1: { p1: 10, p2: 10, exam1: 20 },
    sem2: { p3: 8, p4: 8, exam2: 16 },
    sem3: { p5: 9, p6: 9, exam3: 18 },
    baseMaxScore: 10,
  };
  const active = getActivePeriodKeys("Examen 3e trimestre", "PRIMAIRE");
  const tg =
    computeGroupTotal(subject, 1, active, "PRIMAIRE") +
    computeGroupTotal(subject, 2, active, "PRIMAIRE") +
    computeGroupTotal(subject, 3, active, "PRIMAIRE");

  assert.equal(tg, 108);
  assertNoNaN(tg, "TG primaire");
});

test("primaire : maxima dynamiques agrégés sur 3 trimestres", () => {
  const subjectsMaxima = [
    buildDynamicCourseMaxima(1),
    buildDynamicCourseMaxima(2),
  ];
  const aggregated = aggregateBulletinPeriodMaxima(subjectsMaxima);
  const year = calculateBulletinYearMaxima(aggregated, "PRIMAIRE");

  assert.equal(year.groups.length, 3);
  assert.equal(getBulletinGroupMaxima(year, 1)?.total, 120);
  assert.equal(getBulletinGroupMaxima(year, 2)?.total, 120);
  assert.equal(getBulletinGroupMaxima(year, 3)?.total, 120);
  assert.equal(year.annualTotal, 360);
});

// --- Cas limites ---

test("anciennes fiches : données partielles sans sem3 restent valides", () => {
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
  assertNoNaN(subject.sem1.tt1 ?? 0, "TT1 ancienne fiche");
});

test("périodes manquantes : total partiel sans NaN", () => {
  const subject: Subject = {
    name: "Math",
    sem1: { p1: 5, p2: 0, exam1: 0 },
    sem2: { p3: 0, p4: 0, exam2: 0 },
    baseMaxScore: 10,
  };
  const activeEarly = getActivePeriodKeys("1ere Periode", "SECONDAIRE");
  const activeMid = getActivePeriodKeys("2e Periode", "SECONDAIRE");

  const earlyTotal = computeGroupTotal(subject, 1, activeEarly, "SECONDAIRE");
  const midTotal = computeGroupTotal(subject, 1, activeMid, "SECONDAIRE");

  assert.equal(earlyTotal, 5);
  assert.equal(midTotal, 5);
  assertNoNaN(earlyTotal, "total période partielle");
});

test("maxima absents : pondération en secours", () => {
  const resolved = resolveBulletinMaxScore({
    recordedMaxScore: 0,
    ponderation: 3,
    isExam: true,
  });

  assert.deepEqual(resolved, { value: 60, source: "ponderation" });

  const pct = calculateBulletinPercentage(30, resolved.value);
  assert.equal(pct, 50);
  assertNoNaN(pct, "pourcentage avec pondération de secours");
});

test("maxima à trois chiffres : sommes et pourcentages stables", () => {
  const aggregated = aggregateBulletinPeriodMaxima([
    { p1: 100, p2: 100, exam1: 200, p3: 100, p4: 100, exam2: 200 },
    { p1: 150, p2: 150, exam1: 300, p3: 150, p4: 150, exam2: 300 },
  ]);
  const year = calculateBulletinYearMaxima(aggregated, "SECONDAIRE");

  assert.equal(aggregated.p1, 250);
  assert.equal(getBulletinGroupMaxima(year, 1)?.total, 1000);
  assert.equal(getBulletinGroupMaxima(year, 2)?.total, 1000);
  assert.equal(year.annualTotal, 2000);

  const pct = calculateBulletinPercentage(1500, year.annualTotal);
  assert.equal(pct, 75);
  assertNoNaN(pct, "pourcentage maxima trois chiffres");
});

test("plusieurs pondérations dans le même bulletin : maxima agrégés par période", () => {
  const aggregated = aggregateBulletinPeriodMaxima([
    buildDynamicCourseMaxima(1),
    buildDynamicCourseMaxima(2),
    buildDynamicCourseMaxima(3),
  ]);

  assert.equal(aggregated.p1, 60);
  assert.equal(aggregated.p2, 60);
  assert.equal(aggregated.exam1, 120);
  assert.equal(aggregated.p3, 60);
  assert.equal(aggregated.p4, 60);
  assert.equal(aggregated.exam2, 120);

  const year = calculateBulletinYearMaxima(aggregated, "SECONDAIRE");
  assert.equal(year.annualTotal, 480);
});

test("cas limites : aucun NaN ni division par zéro", () => {
  const edgeCases = [
    calculateBulletinPercentage(50, 0),
    calculateBulletinPercentage(NaN, 100),
    calculateBulletinPercentage(10, NaN),
    calculateBulletinPercentage(0, 0),
    computeGroupTotal(
      { name: "X", sem1: {}, sem2: {}, baseMaxScore: 10 },
      1,
      [],
      "SECONDAIRE",
    ),
  ];

  for (const value of edgeCases) {
    assertNoNaN(value, "résultat cas limite");
  }
});

test("secondaire : formules inchangées (computeTotSem1 / computeTotSem2)", () => {
  const subject: Subject = {
    name: "Math",
    sem1: { p1: 10, p2: 8, exam1: 18 },
    sem2: { p3: 9, p4: 7, exam2: 16 },
    baseMaxScore: 10,
  };
  const active = getActivePeriodKeys("Examen 2e semestre", "SECONDAIRE");

  assert.equal(computeTotSem1(subject, active), 36);
  assert.equal(computeTotSem2(subject, active), 32);
  assert.equal(
    computeTotSem1(subject, active) + computeTotSem2(subject, active),
    computeGroupTotal(subject, 1, active, "SECONDAIRE") +
      computeGroupTotal(subject, 2, active, "SECONDAIRE"),
  );
});

console.log("\n22 tests fonctionnels des calculs de bulletin réussis.");
