import {
  genererCreneaux,
  resolveCourseEndTime,
} from "../src/hooks/getCourseHours";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildDisplayTimeSlots(slots: string[], recreationHour: string) {
  const uniqueSlots = new Set(slots.filter(Boolean));
  if (recreationHour) uniqueSlots.add(recreationHour);
  return Array.from(uniqueSlots).sort((a, b) => {
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });
}

/** Vacation matin 7h30–12h15, cours 45 min, récréation 15 min à 10h15. */
const start = new Date("2000-01-01T07:30:00");
const end = new Date("2000-01-01T12:15:00");
const recreation = new Date("2000-01-01T10:15:00");
const slots = genererCreneaux(start, end, 45, recreation, 15);
const display = buildDisplayTimeSlots(slots, "10:15");
const vacationEnd = "12:15";

assert(slots.includes("11:30"), "11:30 doit être un créneau de début");
assert(
  resolveCourseEndTime("11:30", display, vacationEnd) === "12:15",
  "Le dernier cours doit se terminer à 12:15",
);
assert(
  resolveCourseEndTime("10:30", display, vacationEnd) === "11:15",
  "Les créneaux intermédiaires doivent enchaîner correctement",
);

console.log("OK schedule time slots");
console.log("  créneaux:", slots.join(", "));
console.log("  11:30 →", resolveCourseEndTime("11:30", display, vacationEnd));
