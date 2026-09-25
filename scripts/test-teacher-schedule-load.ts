import assert from "node:assert/strict";
import {
  academicScheduleCalendarMeta,
  formatTeachingHoursLabel,
  sumScheduleMinutes,
  teachingHourUnitMinutes,
  teachingHoursFromMinutes,
} from "../lib/teacher-schedule-load";

assert.equal(teachingHourUnitMinutes("PRIMAIRE"), 30);
assert.equal(teachingHourUnitMinutes("MATERNELLE"), 30);
assert.equal(teachingHourUnitMinutes("SECONDAIRE"), 45);

assert.equal(teachingHoursFromMinutes(240, 30), 8);
assert.equal(teachingHoursFromMinutes(225, 45), 5);
assert.equal(formatTeachingHoursLabel(8), "8H");
assert.equal(formatTeachingHoursLabel(8.5), "8,5H");

const durations = new Map([
  ["c1", 30],
  ["c2", 45],
]);
assert.equal(
  sumScheduleMinutes(
    [{ creneauId: "c1" }, { creneauId: "c1" }, { creneauId: "c2" }],
    durations,
    30,
  ),
  105,
);

const primary = academicScheduleCalendarMeta("PRIMAIRE");
assert.equal(primary.academicPeriodCount, 6);
assert.equal(primary.academicGroupCount, 3);
assert.equal(primary.groupKind, "trimester");

const secondary = academicScheduleCalendarMeta("SECONDAIRE");
assert.equal(secondary.academicPeriodCount, 4);
assert.equal(secondary.academicGroupCount, 2);
assert.equal(secondary.groupKind, "semester");

console.log("✓ teacher-schedule-load");
