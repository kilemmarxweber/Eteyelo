/**
 * Blocs d'affilée — regroupement des créneaux pour le pointage enseignant.
 * Run: pnpm exec tsx scripts/test-attendance-consecutive-blocks.ts
 */
import assert from "node:assert/strict";
import { groupConsecutiveScheduleBlocks } from "../lib/attendance-teacher-session";
import { formatExpectedSessionLabel } from "../lib/attendance-schedule-label";
import { isTeacherCheckInWindow } from "../lib/timezone";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const D = 45;

function slot(
  teachingId: string,
  scheduleId: string,
  startMinutes: number,
) {
  return { teachingId, scheduleId, startMinutes };
}

test("créneau isolé → 1 bloc de 45 min", () => {
  const blocks = groupConsecutiveScheduleBlocks(
    [slot("t1", "s1", 8 * 60)],
    D,
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.durationMinutes, 45);
  assert.equal(blocks[0]!.endMinutes, 8 * 60 + 45);
  assert.deepEqual(blocks[0]!.scheduleIds, ["s1"]);
});

test("2 créneaux adjacents même teaching → 1 bloc 90 min", () => {
  const blocks = groupConsecutiveScheduleBlocks(
    [
      slot("t1", "s1", 7 * 60 + 30),
      slot("t1", "s2", 8 * 60 + 15),
    ],
    D,
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.durationMinutes, 90);
  assert.equal(blocks[0]!.startMinutes, 7 * 60 + 30);
  assert.equal(blocks[0]!.endMinutes, 9 * 60);
  assert.equal(blocks[0]!.firstScheduleId, "s1");
  assert.deepEqual(blocks[0]!.scheduleIds, ["s1", "s2"]);
});

test("3 créneaux adjacents → 1 bloc 135 min", () => {
  const blocks = groupConsecutiveScheduleBlocks(
    [
      slot("t1", "s1", 7 * 60 + 30),
      slot("t1", "s2", 8 * 60 + 15),
      slot("t1", "s3", 9 * 60),
    ],
    D,
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.durationMinutes, 135);
  assert.equal(blocks[0]!.endMinutes, 9 * 60 + 45);
});

test("même teaching avec trou → 2 blocs", () => {
  const blocks = groupConsecutiveScheduleBlocks(
    [
      slot("t1", "s1", 8 * 60),
      slot("t1", "s2", 14 * 60),
    ],
    D,
  );
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.durationMinutes, 45);
  assert.equal(blocks[1]!.durationMinutes, 45);
});

test("deux cours collés (teaching différents) → 2 blocs", () => {
  const blocks = groupConsecutiveScheduleBlocks(
    [
      slot("math", "s1", 8 * 60),
      slot("fr", "s2", 8 * 60 + 45),
    ],
    D,
  );
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.teachingId, "math");
  assert.equal(blocks[1]!.teachingId, "fr");
});

test("ordre désordonné : toujours regroupé correctement", () => {
  const blocks = groupConsecutiveScheduleBlocks(
    [
      slot("t1", "s2", 8 * 60 + 15),
      slot("t1", "s1", 7 * 60 + 30),
      slot("t1", "s3", 9 * 60),
    ],
    D,
  );
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0]!.scheduleIds, ["s1", "s2", "s3"]);
});

test("fenêtre check-in couvre tout le bloc 90 min", () => {
  const start = 7 * 60 + 30;
  // juste avant la fin du 2e créneau
  assert.equal(isTeacherCheckInWindow(8 * 60 + 50, start, 90), true);
  // trop tôt
  assert.equal(isTeacherCheckInWindow(7 * 60, start, 90), false);
});

test("label plage horaire pour un bloc", () => {
  const start = new Date("1970-01-01T07:30:00.000Z");
  const end = new Date("1970-01-01T09:00:00.000Z");
  const label = formatExpectedSessionLabel(
    start,
    {
      cours: { nameCours: "Chimie" },
      classe: { codeClasse: "3 SC", nameClasse: null },
    },
    end,
  );
  assert.equal(label, "07:30–09:00 • 3 SC • Chimie");
});

console.log("\nBlocs d'affilée pointage — OK");
