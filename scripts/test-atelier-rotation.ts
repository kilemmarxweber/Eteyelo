import assert from "node:assert/strict";
import {
  formatRotationCellLabel,
  mondayOfWeekContaining,
  resolveRotationCours,
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
