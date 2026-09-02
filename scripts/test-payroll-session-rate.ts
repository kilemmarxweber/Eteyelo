import assert from "node:assert/strict";
import test from "node:test";

import { CurrencyCode } from "../prisma/generated/prisma/enums";
import {
  allocateSessionGross,
  sessionLossAmount,
  settlePayrollTotals,
} from "../lib/payroll/session-rate";

test("forfait primaire 70 000 : somme des séances = brut", () => {
  const durations = Array.from({ length: 20 }, () => 30);
  const amounts = allocateSessionGross(70_000, durations, CurrencyCode.AOA);
  assert.equal(amounts.length, 20);
  assert.equal(
    amounts.reduce((sum, value) => sum + value, 0),
    70_000,
  );
  for (const amount of amounts) {
    assert.ok(amount === 3500);
  }
});

test("forfait 70 000 / 21 séances : arrondi conservé, totaux = brut", () => {
  const durations = Array.from({ length: 21 }, () => 30);
  const amounts = allocateSessionGross(70_000, durations, CurrencyCode.AOA);
  assert.equal(
    amounts.reduce((sum, value) => sum + value, 0),
    70_000,
  );
  assert.ok(amounts.every((value) => value === 3333 || value === 3334));
});

test("absence d'une séance coupe la valeur réelle de la séance", () => {
  const sessionGross = 3500;
  assert.equal(
    sessionLossAmount(sessionGross, 30, 30, CurrencyCode.AOA),
    3500,
  );
  assert.equal(
    sessionLossAmount(sessionGross, 15, 30, CurrencyCode.AOA),
    1750,
  );
  assert.equal(sessionLossAmount(sessionGross, 0, 30, CurrencyCode.AOA), 0);
});

test("totaux pertes = brut → net 0 KZ", () => {
  const durations = Array.from({ length: 20 }, () => 30);
  const sessionGross = allocateSessionGross(70_000, durations, CurrencyCode.AOA);
  const losses = sessionGross.map((gross) =>
    sessionLossAmount(gross, 30, 30, CurrencyCode.AOA),
  );
  const settled = settlePayrollTotals(
    70_000,
    losses.reduce((sum, value) => sum + value, 0),
    CurrencyCode.AOA,
  );
  assert.equal(settled.gross, 70_000);
  assert.equal(settled.deductions, 70_000);
  assert.equal(settled.net, 0);
});

test("une seule absence : net = brut − valeur de la séance", () => {
  const durations = Array.from({ length: 20 }, () => 30);
  const sessionGross = allocateSessionGross(70_000, durations, CurrencyCode.AOA);
  const losses = sessionGross.map((gross, index) =>
    sessionLossAmount(gross, index === 0 ? 30 : 0, 30, CurrencyCode.AOA),
  );
  const settled = settlePayrollTotals(
    70_000,
    losses.reduce((sum, value) => sum + value, 0),
    CurrencyCode.AOA,
  );
  assert.equal(settled.deductions, 3500);
  assert.equal(settled.net, 66_500);
});
