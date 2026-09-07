import {
  generateCourseStartSlotsForDay,
  isAfternoonVacation,
  resolveVacationHoursForDay,
  saturdayUsesShiftedMorningHours,
  slotHourOnDay,
} from "../lib/creneau-saturday";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const afternoon = {
  startTime: "12:30",
  endTime: "17:15",
  recreationHour: "14:45",
  recreationDuration: 15,
  durationCourse: 45,
};

const morning = {
  startTime: "07:30",
  endTime: "12:15",
  recreationHour: "09:45",
  recreationDuration: 15,
  durationCourse: 45,
};

assert(isAfternoonVacation("12:30"), "12:30 est une vacation d'après-midi");
assert(!isAfternoonVacation("07:30"), "07:30 n'est pas une vacation d'après-midi");
assert(
  saturdayUsesShiftedMorningHours("12:30"),
  "l'après-midi doit basculer le samedi",
);
assert(
  !saturdayUsesShiftedMorningHours("07:30"),
  "le matin ne bascule pas le samedi",
);

const weekdayAfternoon = resolveVacationHoursForDay(afternoon, "Lundi");
assert(
  weekdayAfternoon.startTime === "12:30" && weekdayAfternoon.endTime === "17:15",
  "lundi après-midi inchangé",
);

const saturdayAfternoon = resolveVacationHoursForDay(afternoon, "Samedi");
assert(
  saturdayAfternoon.startTime === "07:30",
  `samedi après-midi doit commencer à 07:30, reçu ${saturdayAfternoon.startTime}`,
);
assert(
  saturdayAfternoon.endTime === "12:15",
  `samedi après-midi doit finir à 12:15 (même durée), reçu ${saturdayAfternoon.endTime}`,
);
assert(
  saturdayAfternoon.recreationHour === "09:45",
  `récré samedi après-midi 09:45, reçu ${saturdayAfternoon.recreationHour}`,
);

const saturdayMorning = resolveVacationHoursForDay(morning, "Samedi");
assert(
  saturdayMorning.startTime === "07:30" && saturdayMorning.endTime === "12:15",
  "samedi matin inchangé",
);

const afternoonWeekdaySlots = generateCourseStartSlotsForDay(afternoon, "Lundi");
const afternoonSaturdaySlots = generateCourseStartSlotsForDay(
  afternoon,
  "Samedi",
);
assert(
  afternoonWeekdaySlots.length === afternoonSaturdaySlots.length,
  `même nombre de séances: ${afternoonWeekdaySlots.length} vs ${afternoonSaturdaySlots.length}`,
);
assert(
  afternoonSaturdaySlots[0] === "07:30",
  `1re séance samedi 07:30, reçu ${afternoonSaturdaySlots[0]}`,
);
assert(
  afternoonSaturdaySlots.every((slot) => slot <= "12:00"),
  `séances samedi avant 12:30: ${afternoonSaturdaySlots.join(" ")}`,
);

const morningSaturdaySlots = generateCourseStartSlotsForDay(morning, "Samedi");
const morningWeekdaySlots = generateCourseStartSlotsForDay(morning, "Mardi");
assert(
  morningSaturdaySlots.join(",") === morningWeekdaySlots.join(","),
  "le matin garde les mêmes créneaux le samedi",
);

assert(
  slotHourOnDay({
    day: "Samedi",
    weekdaySlot: afternoonWeekdaySlots[0]!,
    weekdaySlots: afternoonWeekdaySlots,
    saturdaySlots: afternoonSaturdaySlots,
  }) === "07:30",
  "la 1re ligne samedi correspond à 07:30",
);
assert(
  slotHourOnDay({
    day: "Mercredi",
    weekdaySlot: afternoonWeekdaySlots[0]!,
    weekdaySlots: afternoonWeekdaySlots,
    saturdaySlots: afternoonSaturdaySlots,
  }) === afternoonWeekdaySlots[0],
  "mercredi reste sur l'horaire de semaine",
);

console.log("OK creneau saturday afternoon → 07:30–12:30");
console.log("  semaine:", afternoonWeekdaySlots.join(" · "));
console.log("  samedi: ", afternoonSaturdaySlots.join(" · "));
