import assert from "node:assert/strict";

import {
  DEFAULT_CRENEAU_WORKING_DAYS,
  PRIMARY_CRENEAU_WORKING_DAYS,
  unionCreneauWorkingDays,
} from "../lib/creneau-working-days";
import {
  countAttendanceSchoolDaysInMonth,
  isAttendanceSchoolDay,
  weekendClosedForCycle,
} from "../lib/attendance-school-days";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function utc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

test("primaire et maternelle ferment le week-end", () => {
  assert.equal(weekendClosedForCycle("PRIMAIRE"), true);
  assert.equal(weekendClosedForCycle("MATERNELLE"), true);
  assert.equal(weekendClosedForCycle("SECONDAIRE"), false);
  assert.equal(weekendClosedForCycle("ATELIER"), false);
});

test("primaire : samedi et dimanche ne sont pas des jours de classe", () => {
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 12),
      workingDays: PRIMARY_CRENEAU_WORKING_DAYS,
      weekendClosed: true,
    }),
    false,
  );
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 13),
      workingDays: PRIMARY_CRENEAU_WORKING_DAYS,
      weekendClosed: true,
    }),
    false,
  );
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 11),
      workingDays: PRIMARY_CRENEAU_WORKING_DAYS,
      weekendClosed: true,
    }),
    true,
  );
});

test("primaire ignore samedi même si le créneau le contient", () => {
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 12),
      workingDays: DEFAULT_CRENEAU_WORKING_DAYS,
      weekendClosed: true,
    }),
    false,
  );
});

test("secondaire : samedi compte si le créneau l'inclut", () => {
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 12),
      workingDays: DEFAULT_CRENEAU_WORKING_DAYS,
      weekendClosed: false,
    }),
    true,
  );
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 13),
      workingDays: DEFAULT_CRENEAU_WORKING_DAYS,
      weekendClosed: false,
    }),
    false,
  );
});

test("jour férié calendrier retiré du décompte", () => {
  const closed = new Set(["2026-09-10"]);
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 10),
      workingDays: PRIMARY_CRENEAU_WORKING_DAYS,
      closedDayKeys: closed,
      dayIso: "2026-09-10",
      weekendClosed: true,
    }),
    false,
  );
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 11),
      workingDays: PRIMARY_CRENEAU_WORKING_DAYS,
      closedDayKeys: closed,
      dayIso: "2026-09-11",
      weekendClosed: true,
    }),
    true,
  );
});

test("créneau Lun-Ven : mercredi décoché n'est pas un jour de classe", () => {
  const withoutWednesday = PRIMARY_CRENEAU_WORKING_DAYS.filter(
    (day) => day !== "Mercredi",
  );
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 9),
      workingDays: withoutWednesday,
      weekendClosed: true,
    }),
    false,
  );
  assert.equal(
    isAttendanceSchoolDay({
      date: utc(2026, 9, 10),
      workingDays: withoutWednesday,
      weekendClosed: true,
    }),
    true,
  );
});

test("septembre 2026 primaire : 22 jours, moins un férié = 21", () => {
  assert.equal(
    countAttendanceSchoolDaysInMonth({
      year: 2026,
      month: 9,
      workingDays: PRIMARY_CRENEAU_WORKING_DAYS,
      weekendClosed: true,
    }),
    22,
  );
  assert.equal(
    countAttendanceSchoolDaysInMonth({
      year: 2026,
      month: 9,
      workingDays: PRIMARY_CRENEAU_WORKING_DAYS,
      closedDayKeys: new Set(["2026-09-10"]),
      weekendClosed: true,
    }),
    21,
  );
});

test("union des créneaux conserve le week-end seulement s'il est présent", () => {
  const union = unionCreneauWorkingDays(
    [PRIMARY_CRENEAU_WORKING_DAYS, DEFAULT_CRENEAU_WORKING_DAYS],
  );
  assert.ok(union.includes("Samedi"));
  const primaryOnly = unionCreneauWorkingDays(
    [PRIMARY_CRENEAU_WORKING_DAYS],
    PRIMARY_CRENEAU_WORKING_DAYS,
  );
  assert.equal(primaryOnly.includes("Samedi"), false);
});

console.log("\nTous les tests jours de classe (créneau + fériés) sont passes.");
