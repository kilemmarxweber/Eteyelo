import {
  weeklyInterventionsFromMinutes,
  weeklyMinutesFromInterventions,
} from "../lib/teaching-volume";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  weeklyMinutesFromInterventions(4, 45) === 180,
  "45 × 4 = 180",
);
assert(
  weeklyInterventionsFromMinutes(180, 45) === 4,
  "180 / 45 = 4",
);
assert(
  weeklyInterventionsFromMinutes(135, 45) === 3,
  "données existantes 135 min → 3 interventions",
);
assert(
  weeklyMinutesFromInterventions(null, 45) === undefined,
  "sans interventions → pas de volume",
);

console.log("OK teaching-volume: durée × interventions");
