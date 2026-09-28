import assert from "node:assert/strict";
import {
  advanceRotationAfterSlotEnded,
  compareSlotsByLivePriority,
  formatRotationCellLabel,
  getLiveSlotPhase,
  mondayOfWeekContaining,
  resolveRotationCours,
  rotationSlotEndHm,
  weeksBetweenMondays,
} from "../lib/atelier-rotation";
import { buildAtelierLabGroupLabel } from "../lib/atelier-lab-groups-shared";
import {
  isPracticalDomainCode,
  PRACTICAL_DOMAIN_CATALOG,
} from "../lib/practical-domains";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("catalogue domaines pratiques", () => {
  assert.equal(PRACTICAL_DOMAIN_CATALOG.length, 3);
  assert.equal(isPracticalDomainCode("SCIENCES"), true);
  assert.equal(isPracticalDomainCode("PRIMAIRE"), false);
  assert.equal(
    PRACTICAL_DOMAIN_CATALOG.find((d) => d.code === "SCIENCES")
      ?.defaultRoomName,
    "Laboratoire sciences",
  );
});

test("lundi de semaine et weeksBetween", () => {
  // 2026-09-24 is Thursday
  const thursday = new Date("2026-09-24T12:00:00.000Z");
  const monday = mondayOfWeekContaining(thursday);
  assert.equal(monday.toISOString().slice(0, 10), "2026-09-21");

  const nextMonday = mondayOfWeekContaining(
    new Date("2026-09-28T12:00:00.000Z"),
  );
  assert.equal(weeksBetweenMondays(monday, nextMonday), 1);
});

test("rotation cycle N cours (chimie → biologie)", () => {
  const items = [
    { coursId: "c1", nameCours: "Chimie", sortOrder: 0 },
    { coursId: "c2", nameCours: "Biologie", sortOrder: 1 },
  ];
  const anchor = new Date("2026-09-21T00:00:00.000Z"); // week 0 = Chimie

  const week0 = resolveRotationCours({
    anchorDate: anchor,
    items,
    date: new Date("2026-09-21T12:00:00.000Z"),
  });
  assert.equal(week0.nameCours, "Chimie");
  assert.equal(week0.weekInCycle, 1);
  assert.equal(week0.isRotating, true);

  const week1 = resolveRotationCours({
    anchorDate: anchor,
    items,
    date: new Date("2026-09-28T12:00:00.000Z"),
  });
  assert.equal(week1.nameCours, "Biologie");
  assert.equal(week1.weekInCycle, 2);

  const week2 = resolveRotationCours({
    anchorDate: anchor,
    items,
    date: new Date("2026-10-05T12:00:00.000Z"),
  });
  assert.equal(week2.nameCours, "Chimie");
});

test("un seul cours = pas de rotation", () => {
  const week0 = resolveRotationCours({
    anchorDate: new Date("2026-09-21T00:00:00.000Z"),
    items: [{ coursId: "c1", nameCours: "Chimie", sortOrder: 0 }],
    date: new Date("2026-09-28T12:00:00.000Z"),
  });
  assert.equal(week0.isRotating, false);
  assert.equal(week0.nameCours, "Chimie");
  assert.equal(week0.weekInCycle, 1);
});

test("après fin créneau, le suivant est prioritaire", () => {
  assert.equal(rotationSlotEndHm("08:00", 120), "10:00");

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const phaseMorning = getLiveSlotPhase({
    slotDate: today,
    startHm: "08:00",
    durationMinutes: 120,
    now: today,
  });
  assert.equal(phaseMorning, "past");

  const phaseAfternoon = getLiveSlotPhase({
    slotDate: today,
    startHm: "14:00",
    durationMinutes: 120,
    now: today,
  });
  assert.equal(phaseAfternoon, "upcoming");

  const sorted = [
    { phase: phaseMorning, startHm: "08:00", day: "Lundi" },
    { phase: phaseAfternoon, startHm: "14:00", day: "Lundi" },
  ].sort(compareSlotsByLivePriority);
  assert.equal(sorted[0]!.startHm, "14:00");
});

test("fin de créneau → active S2 directement", () => {
  const items = [
    {
      coursId: "c1",
      nameCours: "Chimie",
      sortOrder: 0,
      teacherName: "A B C",
    },
    {
      coursId: "c2",
      nameCours: "Biologie",
      sortOrder: 1,
      teacherName: "D E F",
    },
  ];
  const resolved = resolveRotationCours({
    anchorDate: new Date("2026-09-21T00:00:00.000Z"),
    items,
    date: new Date("2026-09-21T12:00:00.000Z"),
  });
  assert.equal(resolved.nameCours, "Chimie");
  assert.equal(resolved.weekInCycle, 1);

  const advanced = advanceRotationAfterSlotEnded({
    resolved,
    items,
    phase: "past",
  });
  assert.equal(advanced.nameCours, "Biologie");
  assert.equal(advanced.weekInCycle, 2);
  assert.equal(advanced.advancedAfterEnd, true);
  assert.equal(advanced.teacherName, "D E F");

  const stillCurrent = advanceRotationAfterSlotEnded({
    resolved,
    items,
    phase: "current",
  });
  assert.equal(stillCurrent.nameCours, "Chimie");
  assert.equal(stillCurrent.advancedAfterEnd ?? false, false);
});

test("férié : séance fermée, cycle non décalé", () => {
  const items = [
    { coursId: "c1", nameCours: "Chimie", sortOrder: 0 },
    { coursId: "c2", nameCours: "Biologie", sortOrder: 1 },
  ];
  const anchor = new Date("2026-09-21T00:00:00.000Z");
  const closed = resolveRotationCours({
    anchorDate: anchor,
    items,
    date: new Date("2026-09-21T12:00:00.000Z"),
    isClosed: true,
  });
  assert.equal(closed.isClosed, true);
  assert.equal(closed.nameCours, "Chimie");
  assert.equal(
    formatRotationCellLabel({
      domainName: "Domaine des sciences",
      resolved: closed,
      roomName: "Laboratoire sciences",
    }).startsWith("Fermé"),
    true,
  );
});

test("libellé groupe labo = nom du laboratoire uniquement", () => {
  assert.equal(
    buildAtelierLabGroupLabel({
      roomName: "Laboratoire sciences",
      sourceClasseName: "3ème A",
      fallbackName: "Groupe",
    }),
    "Laboratoire sciences",
  );
  assert.equal(
    buildAtelierLabGroupLabel({
      domainName: "Domaine technique",
      fallbackName: "Groupe",
    }),
    "Domaine technique",
  );
});

console.log("\nAll atelier rotation tests passed.");
