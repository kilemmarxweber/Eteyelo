/**
 * Smoke tests — résumé financier quotidien propriétaire.
 * Run: pnpm exec tsx scripts/test-owner-daily-finance-summary.ts
 */
import assert from "node:assert/strict";

import {
  formatOwnerDailyFinanceText,
  formatOwnerDailyFinanceWhatsAppLines,
  hasOwnerDailyFinanceActivity,
  isOwnerDailyFinanceSunday,
  type OwnerDailyFinanceSummary,
} from "../lib/reports/owner-daily-finance-summary";
import { dayRangeInAppTimezone, getAppWeekday } from "../lib/timezone";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const sample: OwnerDailyFinanceSummary = {
  organizationId: "org1",
  organizationName: "Groupe Scolaire Demo",
  dateKey: "2026-09-13",
  dateLabel: "dimanche 13 septembre 2026",
  currency: "AOA",
  branches: [
    {
      branchId: "b1",
      branchName: "ECPEL",
      income: 20000,
      expenses: 5000,
      cashBalance: 15000,
      newEnrollments: 10,
      currency: "AOA",
    },
    {
      branchId: "b2",
      branchName: "CEPP",
      income: 115000,
      expenses: 0,
      cashBalance: 115000,
      newEnrollments: 20,
      currency: "AOA",
    },
  ],
  totalIncome: 135000,
  totalExpenses: 5000,
  totalCashBalance: 130000,
  totalNewEnrollments: 30,
};

test("hasOwnerDailyFinanceActivity : vide → false", () => {
  assert.equal(hasOwnerDailyFinanceActivity(null), false);
  assert.equal(
    hasOwnerDailyFinanceActivity({
      ...sample,
      branches: [],
      totalIncome: 0,
      totalExpenses: 0,
      totalCashBalance: 0,
      totalNewEnrollments: 0,
    }),
    false,
  );
  assert.equal(
    hasOwnerDailyFinanceActivity({
      ...sample,
      branches: [
        {
          ...sample.branches[0],
          income: 0,
          expenses: 0,
          newEnrollments: 0,
          cashBalance: 999,
        },
      ],
    }),
    false,
    "solde historique seul ne compte pas",
  );
});

test("hasOwnerDailyFinanceActivity : mouvement ou inscription → true", () => {
  assert.equal(hasOwnerDailyFinanceActivity(sample), true);
  assert.equal(
    hasOwnerDailyFinanceActivity({
      ...sample,
      branches: [
        {
          ...sample.branches[0],
          income: 0,
          expenses: 0,
          cashBalance: 0,
          newEnrollments: 2,
        },
      ],
    }),
    true,
  );
});

test("format texte contient établissements et totaux", () => {
  const text = formatOwnerDailyFinanceText(sample);
  assert.match(text, /Établissement ECPEL/);
  assert.match(text, /Établissement CEPP/);
  assert.match(text, /Entrées/);
  assert.match(text, /Sorties/);
  assert.match(text, /Caisse réelle/);
  assert.match(text, /Nouveaux inscrits/);
  assert.match(text, /Total/);
  assert.match(text, /130\.000 Kz/);
  assert.match(text, /30 élèves/);
});

test("format WhatsApp compact type exemple métier", () => {
  const lines = formatOwnerDailyFinanceWhatsAppLines(sample);
  assert.equal(
    lines[0],
    "Établissement ECPEL : 15.000 Kz, Nouveau inscrit 10 élèves",
  );
  assert.equal(
    lines[1],
    "Établissement CEPP : 115.000 Kz, Nouveau inscrit 20 élèves",
  );
  assert.equal(lines[2], "Total 130.000 Kz et 30 élèves");
});

test("dayRangeInAppTimezone : fenêtre d'environ 24 h", () => {
  const { start, end, dateKey } = dayRangeInAppTimezone(
    new Date("2026-09-13T16:55:00.000Z"),
  );
  assert.match(dateKey, /^\d{4}-\d{2}-\d{2}$/);
  const duration = end.getTime() - start.getTime();
  assert.equal(duration, 86_400_000);
});

test("dimanche : aucun envoi", () => {
  // 2026-09-13 est un dimanche en fuseau Africa/Kinshasa
  const sunday = new Date("2026-09-13T16:55:00.000Z");
  assert.equal(getAppWeekday(sunday), 0);
  assert.equal(isOwnerDailyFinanceSunday(sunday), true);

  // 2026-09-14 est un lundi
  const monday = new Date("2026-09-14T16:55:00.000Z");
  assert.notEqual(getAppWeekday(monday), 0);
  assert.equal(isOwnerDailyFinanceSunday(monday), false);
});

console.log("\nAll owner-daily-finance-summary smoke tests passed.");
