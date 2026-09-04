import assert from "node:assert/strict";
import test from "node:test";

import { CurrencyCode } from "../prisma/generated/prisma/enums";
import { allocateSessionGross, sessionLossAmount, settlePayrollTotals } from "../lib/payroll/session-rate";
import { resolvePersonnelPay } from "../lib/payroll/personnel-scales";
import {
  billableLateMinutes,
  isPayrollWeekendDate,
  monthlyMinutesFromWeeklyVolume,
  payrollSessionAmount,
  personnelUnitRates,
  primaryUnitRates,
  rawLateMinutes,
  secondaryMatriculeRates,
  secondaryNonMatriculeRates,
  sessionGrossFromRate,
  weekdayCountInMonth,
  weeklyVolumeFromScheduleSlots,
} from "../lib/payroll/primary-volume";

const PRIMARY_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"] as const;

function typicalPrimaryWeek(sessionsPerDay = 8, minutes = 30) {
  return PRIMARY_DAYS.flatMap((day) =>
    Array.from({ length: sessionsPerDay }, () => ({ day, durationMinutes: minutes })),
  );
}

test("horaire primaire : 8 séances × 30 min × 5 jours = 1 200 min/sem", () => {
  const weekly = weeklyVolumeFromScheduleSlots(typicalPrimaryWeek());
  assert.equal(weekly.sessions, 40);
  assert.equal(weekly.minutes, 1_200);
  assert.equal(weekly.minutesByDay.Lundi, 240);
  assert.equal(weekly.sessionsByDay.Vendredi, 8);
});

test("samedi et dimanche sont exclus du volume", () => {
  const weekly = weeklyVolumeFromScheduleSlots([
    ...typicalPrimaryWeek(),
    { day: "Samedi", durationMinutes: 30 },
    { day: "Dimanche", durationMinutes: 30 },
  ]);
  assert.equal(weekly.minutes, 1_200);
  assert.equal(weekly.sessions, 40);
  assert.equal(isPayrollWeekendDate(new Date(Date.UTC(2026, 8, 5))), true); // samedi 5 sept
  assert.equal(isPayrollWeekendDate(new Date(Date.UTC(2026, 8, 6))), true); // dimanche 6 sept
  assert.equal(isPayrollWeekendDate(new Date(Date.UTC(2026, 8, 4))), false); // vendredi
});

test("septembre 2026 : 22 jours ouvrés × 240 min = 5 280 min", () => {
  const weekly = weeklyVolumeFromScheduleSlots(typicalPrimaryWeek());
  assert.equal(monthlyMinutesFromWeeklyVolume(weekly, 2026, 9), 5_280);
});

test("forfait 70 000 : coût réel d'une séance de 30 min et d'1 minute", () => {
  const weekly = weeklyVolumeFromScheduleSlots(typicalPrimaryWeek());
  const monthlyMinutes = monthlyMinutesFromWeeklyVolume(weekly, 2026, 9);
  const { ratePerMinute, ratePerSession } = primaryUnitRates(
    70_000,
    monthlyMinutes,
    30,
    CurrencyCode.AOA,
  );
  assert.equal(monthlyMinutes, 5_280);
  assert.ok(Math.abs(ratePerMinute - 70_000 / 5_280) < 1e-9);
  assert.equal(ratePerSession, 398);
  const oneMinute = sessionGrossFromRate(ratePerMinute, 1, CurrencyCode.AOA);
  assert.equal(oneMinute, 13);
});

test("absence d'une séance : on retranche uniquement la valeur de 30 min", () => {
  const weekly = weeklyVolumeFromScheduleSlots(typicalPrimaryWeek());
  const monthlyMinutes = monthlyMinutesFromWeeklyVolume(weekly, 2026, 9);
  const { ratePerMinute, ratePerSession } = primaryUnitRates(
    70_000,
    monthlyMinutes,
    30,
    CurrencyCode.AOA,
  );
  const sessionGross = sessionGrossFromRate(ratePerMinute, 30, CurrencyCode.AOA);
  assert.equal(sessionGross, ratePerSession);
  const settled = settlePayrollTotals(
    70_000,
    sessionLossAmount(sessionGross, 30, 30, CurrencyCode.AOA),
    CurrencyCode.AOA,
  );
  assert.equal(settled.deductions, 398);
  assert.equal(settled.net, 69_602);
});

test("franchise 5 min : retard autorisé = 0 retenue, au-delà 1 min est facturée", () => {
  assert.equal(billableLateMinutes(1, 5), 0);
  assert.equal(billableLateMinutes(5, 5), 0);
  assert.equal(billableLateMinutes(6, 5), 1);
  const start = new Date("2026-09-04T07:30:00.000Z");
  const fourMinLate = new Date("2026-09-04T07:34:00.000Z");
  const sixMinLate = new Date("2026-09-04T07:36:00.000Z");
  assert.equal(rawLateMinutes(fourMinLate, start), 4);
  assert.equal(billableLateMinutes(rawLateMinutes(fourMinLate, start), 5), 0);
  assert.equal(billableLateMinutes(rawLateMinutes(sixMinLate, start), 5), 1);

  const weekly = weeklyVolumeFromScheduleSlots(typicalPrimaryWeek());
  const monthlyMinutes = monthlyMinutesFromWeeklyVolume(weekly, 2026, 9);
  const { ratePerMinute } = primaryUnitRates(70_000, monthlyMinutes, 30, CurrencyCode.AOA);
  const sessionGross = sessionGrossFromRate(ratePerMinute, 30, CurrencyCode.AOA);
  assert.equal(sessionLossAmount(sessionGross, 0, 30, CurrencyCode.AOA), 0);
  assert.equal(sessionLossAmount(sessionGross, 1, 30, CurrencyCode.AOA), 13);
});

test("horaire secondaire réduit : 5 séances × 45 min = 225 min/sem, classes distinctes", () => {
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"] as const;
  const weekly = weeklyVolumeFromScheduleSlots(
    days.map((day) => ({ day, durationMinutes: 45 })),
  );
  assert.equal(weekly.sessions, 5);
  assert.equal(weekly.minutes, 225);
  assert.equal(weekly.sessionsByDay.Lundi, 1);
  assert.equal(weekly.minutesByDay.Mardi, 45);
});

test("secondaire non matriculé : 1 500 / séance de 45 min, 1 min = 33", () => {
  const { ratePerMinute, ratePerSession } = secondaryNonMatriculeRates(
    1_500,
    45,
    CurrencyCode.AOA,
  );
  assert.equal(ratePerSession, 1_500);
  assert.equal(sessionGrossFromRate(ratePerMinute, 45, CurrencyCode.AOA), 1_500);
  assert.equal(sessionGrossFromRate(ratePerMinute, 1, CurrencyCode.AOA), 33);
  assert.equal(sessionLossAmount(1_500, 45, 45, CurrencyCode.AOA), 1_500);
  assert.equal(sessionLossAmount(1_500, 1, 45, CurrencyCode.AOA), 33);
  assert.equal(sessionLossAmount(1_500, 0, 45, CurrencyCode.AOA), 0);
});

test("secondaire matriculé : 30 % du montant de séance du barème", () => {
  const { ratePerMinute, ratePerSession } = secondaryMatriculeRates(
    1_500,
    30,
    45,
    CurrencyCode.AOA,
  );
  assert.equal(ratePerSession, 450);
  assert.ok(Math.abs(ratePerMinute - 10) < 1e-9);
  assert.equal(sessionLossAmount(450, 45, 45, CurrencyCode.AOA), 450);
  assert.equal(sessionLossAmount(450, 1, 45, CurrencyCode.AOA), 10);
  const weekly = weeklyVolumeFromScheduleSlots(
    ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"].map((day) => ({
      day,
      durationMinutes: 45,
    })),
  );
  const monthlyMinutes = monthlyMinutesFromWeeklyVolume(weekly, 2026, 9);
  assert.equal(monthlyMinutes, 990);
});

test("montant de séance du barème : 30 % du champ séance, repli taux horaire", () => {
  assert.equal(
    payrollSessionAmount({
      secondaryNonMatriculeSessionRate: 1_500,
      secondaryHourlyRate: 2_000,
    }),
    1_500,
  );
  assert.equal(
    payrollSessionAmount({
      secondaryNonMatriculeSessionRate: 0,
      secondaryHourlyRate: 1_500,
    }),
    1_500,
  );
});

test("maternelle forfait 100 000 : séance 30 min et absence = valeur de la séance", () => {
  const weekly = weeklyVolumeFromScheduleSlots(typicalPrimaryWeek());
  const monthlyMinutes = monthlyMinutesFromWeeklyVolume(weekly, 2026, 9);
  const { ratePerMinute, ratePerSession } = primaryUnitRates(
    100_000,
    monthlyMinutes,
    30,
    CurrencyCode.AOA,
  );
  assert.equal(monthlyMinutes, 5_280);
  const sessionGross = sessionGrossFromRate(ratePerMinute, 30, CurrencyCode.AOA);
  assert.equal(sessionGross, ratePerSession);
  const settled = settlePayrollTotals(
    100_000,
    sessionLossAmount(sessionGross, 30, 30, CurrencyCode.AOA),
    CurrencyCode.AOA,
  );
  assert.equal(settled.deductions, ratePerSession);
  assert.equal(settled.net, 100_000 - ratePerSession);
});

test("personnel : 22 jours ouvrés, absence = 1 journée, franchise 5 min", () => {
  assert.equal(weekdayCountInMonth(2026, 9), 22);
  const total = 100_000 + 20_000;
  const { ratePerDay, ratePerMinute } = personnelUnitRates(
    total,
    22,
    480,
    CurrencyCode.AOA,
  );
  assert.equal(ratePerDay, 5_455);
  const dayGrosses = allocateSessionGross(
    total,
    Array.from({ length: 22 }, () => 480),
    CurrencyCode.AOA,
  );
  assert.equal(
    dayGrosses.reduce((sum, value) => sum + value, 0),
    120_000,
  );
  assert.equal(sessionLossAmount(dayGrosses[0]!, 480, 480, CurrencyCode.AOA), dayGrosses[0]);
  assert.equal(billableLateMinutes(5, 5), 0);
  assert.equal(billableLateMinutes(6, 5), 1);
  const sixMinLoss = sessionLossAmount(dayGrosses[0]!, 1, 480, CurrencyCode.AOA);
  assert.ok(sixMinLoss >= 11 && sixMinLoss <= 12);
  assert.ok(ratePerMinute > 0);
});

test("personnel : fiche remplace le brut du rôle, la prime du barème reste", () => {
  const scales = [
    { role: "caissier", gross: 80_000, prime: 10_000 },
    { role: "directeur", gross: 150_000, prime: 20_000 },
  ];
  const fromBareme = resolvePersonnelPay({
    ficheForfait: null,
    orgRole: "caissier",
    scales,
  });
  assert.equal(fromBareme.gross, 80_000);
  assert.equal(fromBareme.prime, 10_000);
  assert.equal(fromBareme.total, 90_000);
  const fromFiche = resolvePersonnelPay({
    ficheForfait: 95_000,
    orgRole: "caissier",
    scales,
  });
  assert.equal(fromFiche.gross, 95_000);
  assert.equal(fromFiche.prime, 10_000);
  assert.equal(fromFiche.total, 105_000);
});
