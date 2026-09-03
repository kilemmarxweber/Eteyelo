import assert from "node:assert/strict";
import test from "node:test";

import { CurrencyCode } from "../prisma/generated/prisma/enums";
import {
  addCalendarMonths,
  planAdvanceInstallments,
  splitAdvanceInstallments,
} from "../lib/payroll/salary-advance";

test("3 séances de 30 000 AOA : 10 000 par mois", () => {
  const amounts = splitAdvanceInstallments(30_000, 3, CurrencyCode.AOA);
  assert.deepEqual(amounts, [10_000, 10_000, 10_000]);
});

test("reste d’arrondi sur la dernière séance", () => {
  const amounts = splitAdvanceInstallments(10_000, 3, CurrencyCode.AOA);
  assert.equal(
    amounts.reduce((sum, value) => sum + value, 0),
    10_000,
  );
  assert.equal(amounts[0], 3333);
  assert.equal(amounts[1], 3333);
  assert.equal(amounts[2], 3334);
});

test("plan : une séance = un mois calendaire", () => {
  const plan = planAdvanceInstallments({
    total: 12_000,
    count: 3,
    currency: CurrencyCode.AOA,
    firstYear: 2026,
    firstMonth: 11,
  });
  assert.deepEqual(
    plan.map((item) => `${item.sequence}:${item.month}/${item.year}`),
    ["1:11/2026", "2:12/2026", "3:1/2027"],
  );
});

test("addCalendarMonths traverse décembre", () => {
  assert.deepEqual(addCalendarMonths(2026, 12, 1), { year: 2027, month: 1 });
});
