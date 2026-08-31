import assert from "node:assert/strict";
import test from "node:test";

import { calendarYearForSchoolMonth } from "../lib/payroll/calendar-year";

test("année scolaire sept→juillet : mois de cours", () => {
  const schoolYear = {
    startYear: "2026-09-06T23:00:00.000Z",
    endYear: "2027-07-01T23:00:00.000Z",
  };

  assert.equal(calendarYearForSchoolMonth(schoolYear, 9), 2026);
  assert.equal(calendarYearForSchoolMonth(schoolYear, 12), 2026);
  assert.equal(calendarYearForSchoolMonth(schoolYear, 1), 2027);
  assert.equal(calendarYearForSchoolMonth(schoolYear, 7), 2027);
});

test("année scolaire sept→juillet : août rattache à l'année de rentrée", () => {
  const schoolYear = {
    startYear: "2026-09-06T23:00:00.000Z",
    endYear: "2027-07-01T23:00:00.000Z",
  };

  // Régression : l'ancien mapping renvoyait 2027 → brouillons à 0 AOA.
  assert.equal(calendarYearForSchoolMonth(schoolYear, 8), 2026);
});
