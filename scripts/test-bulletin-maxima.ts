import assert from "node:assert/strict";

import {
  aggregateBulletinPeriodMaxima,
  calculateBulletinPercentage,
  calculateBulletinYearMaxima,
  resolveBulletinMaxScore,
  sumBulletinMaxima,
} from "../lib/bulletin-maxima";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("pondération 1 : maximum normal égal à 10", () => {
  assert.deepEqual(resolveBulletinMaxScore({ ponderation: 1 }), {
    value: 10,
    source: "ponderation",
  });
});

test("pondération 2 : maximum normal égal à 20", () => {
  assert.deepEqual(resolveBulletinMaxScore({ ponderation: 2 }), {
    value: 20,
    source: "ponderation",
  });
});

test("pondération 3 : maximum normal égal à 30", () => {
  assert.deepEqual(resolveBulletinMaxScore({ ponderation: 3 }), {
    value: 30,
    source: "ponderation",
  });
});

test("examen avec pondération 2 : maximum égal à 40", () => {
  assert.deepEqual(
    resolveBulletinMaxScore({ ponderation: 2, isExam: true }),
    { value: 40, source: "ponderation" },
  );
});

test("plusieurs cours ayant des pondérations différentes", () => {
  const maxima = aggregateBulletinPeriodMaxima([
    { p1: 10, p2: 10, exam1: 20 },
    { p1: 20, p2: 20, exam1: 40 },
    { p1: 30, p2: 30, exam1: 60 },
  ]);

  assert.deepEqual(maxima, { p1: 60, p2: 60, exam1: 120 });
});

test("maximum historique conservé sans pondération actuelle", () => {
  assert.deepEqual(resolveBulletinMaxScore({ recordedMaxScore: 70 }), {
    value: 70,
    source: "recorded",
  });
});

test("maximum historique prioritaire sur une nouvelle pondération", () => {
  assert.deepEqual(
    resolveBulletinMaxScore({
      recordedMaxScore: 20,
      ponderation: 3,
      isExam: false,
    }),
    { value: 20, source: "recorded" },
  );
});

test("ancienne fiche à 20 conservée après passage de la pondération à 3", () => {
  const oldBulletinMaximum = resolveBulletinMaxScore({
    recordedMaxScore: 20,
    ponderation: 3,
  });

  assert.deepEqual(oldBulletinMaximum, {
    value: 20,
    source: "recorded",
  });
});

test("nouvelle fiche créée après passage de la pondération à 3 utilise 30", () => {
  const newFicheMaximum = resolveBulletinMaxScore({
    ponderation: 3,
  });

  assert.deepEqual(newFicheMaximum, {
    value: 30,
    source: "ponderation",
  });
});

test("ancien maximum d’examen enregistré n’est pas doublé une seconde fois", () => {
  const oldExamMaximum = resolveBulletinMaxScore({
    recordedMaxScore: 40,
    ponderation: 3,
    isExam: true,
  });

  assert.deepEqual(oldExamMaximum, {
    value: 40,
    source: "recorded",
  });
});

test("maximum absent : utilisation de la pondération actuelle", () => {
  assert.deepEqual(
    resolveBulletinMaxScore({ recordedMaxScore: 0, ponderation: 3 }),
    { value: 30, source: "ponderation" },
  );
});

test("configuration absente : fallback compatible égal à 10", () => {
  assert.deepEqual(resolveBulletinMaxScore({}), {
    value: 10,
    source: "fallback",
  });
});

test("total du premier semestre", () => {
  const result = calculateBulletinYearMaxima({
    p1: 60,
    p2: 60,
    exam1: 120,
  });

  assert.equal(result.semester1.total, 240);
});

test("total du deuxième semestre", () => {
  const result = calculateBulletinYearMaxima({
    p3: 40,
    p4: 40,
    exam2: 80,
  });

  assert.equal(result.semester2.total, 160);
});

test("total annuel égal à la somme des deux semestres", () => {
  const result = calculateBulletinYearMaxima({
    p1: 60,
    p2: 60,
    exam1: 120,
    p3: 40,
    p4: 40,
    exam2: 80,
  });

  assert.equal(result.semester1.total, 240);
  assert.equal(result.semester2.total, 160);
  assert.equal(result.annualTotal, 400);
});

test("pourcentage calculé depuis le maximum réel", () => {
  assert.equal(calculateBulletinPercentage(45, 60), 75);
});

test("division par zéro impossible", () => {
  assert.equal(calculateBulletinPercentage(10, 0), 0);
  assert.equal(calculateBulletinPercentage(10, Number.NaN), 0);
});

test("les maxima invalides ne faussent pas une somme", () => {
  assert.equal(
    sumBulletinMaxima([10, 20, Number.NaN, Number.POSITIVE_INFINITY, -5]),
    30,
  );
});

console.log("\n18 tests fonctionnels et historiques du bulletin réussis.");
