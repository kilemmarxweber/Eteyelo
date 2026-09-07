import type { Day } from "../prisma/generated/prisma/client";
import { generateCourseStartSlotsForDay } from "../lib/creneau-saturday";
import {
  generateCourseStartSlots,
  maxSessionsPerSpreadDay,
  parseHmToMinutes,
  placeTeachingsGreedy,
  placeTeachingsWithRetries,
  type PlacementCandidate,
} from "../lib/schedule-auto-generate";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  maxSessionsPerSpreadDay({
    sessionsNeeded: 3,
    attachedDayCount: 2,
    consecutiveSlots: 2,
  }) === 2,
  "3 séances / 2 jours / 2 h d'affilée → max 2 par jour",
);
assert(
  maxSessionsPerSpreadDay({
    sessionsNeeded: 3,
    attachedDayCount: 3,
    consecutiveSlots: 2,
  }) === 2,
  "3 séances / 3 jours / 2 h d'affilée → max 2 (le bloc d'affilée)",
);
assert(
  maxSessionsPerSpreadDay({
    sessionsNeeded: 3,
    attachedDayCount: 1,
    consecutiveSlots: 2,
  }) === 3,
  "un seul jour attaché → tout peut aller dessus",
);

const courseSlots = ["07:30", "08:15", "09:00", "09:45", "10:45", "11:30"];
const duration = 45;

function countByDay(
  placed: Array<{ teachingId: string; day: Day; hourHm: string }>,
  teachingId?: string,
) {
  const byDay = new Map<Day, number>();
  for (const row of placed) {
    if (teachingId && row.teachingId !== teachingId) continue;
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + 1);
  }
  return byDay;
}

const baseCandidate: PlacementCandidate = {
  teachingId: "t-fr",
  teacherId: "teacher-1",
  courseName: "Français",
  sessionsNeeded: 3,
  titulaire: false,
  weeklyMinutes: 135,
  consecutiveSlots: 2,
  preferredDays: ["Lundi", "Mercredi"],
};

for (let i = 0; i < 24; i += 1) {
  const result = placeTeachingsGreedy({
    candidates: [baseCandidate],
    courseSlots,
    durationCourseMinutes: duration,
    occupiedClassSlots: new Set(),
    occupiedTeacherIntervals: new Map(),
    workDays: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"],
  });

  assert(result.failures.length === 0, `essai ${i}: placement incomplet`);
  assert(result.placed.length === 3, `essai ${i}: 3 séances attendues`);

  const byDay = countByDay(result.placed);
  const daysUsed = [...byDay.keys()];
  assert(
    daysUsed.every((day) => day === "Lundi" || day === "Mercredi"),
    `essai ${i}: hors jours attachés (${daysUsed.join(", ")})`,
  );
  assert(
    daysUsed.length === 2,
    `essai ${i}: les 2 jours attachés doivent être utilisés, pas seulement le dernier`,
  );
  for (const [day, count] of byDay) {
    assert(
      count <= 2,
      `essai ${i}: ${count} séances le ${day} (3 matières sur un seul jour interdit)`,
    );
  }
}

const components: PlacementCandidate[] = [
  {
    teachingId: "ecriture",
    teacherId: "teacher-1",
    courseName: "Écriture",
    sessionsNeeded: 1,
    titulaire: false,
    weeklyMinutes: 45,
    consecutiveSlots: 1,
    preferredDays: ["Lundi", "Mercredi"],
  },
  {
    teachingId: "recitation",
    teacherId: "teacher-1",
    courseName: "Récitation",
    sessionsNeeded: 1,
    titulaire: false,
    weeklyMinutes: 45,
    consecutiveSlots: 1,
    preferredDays: ["Lundi", "Mercredi"],
  },
  {
    teachingId: "redaction",
    teacherId: "teacher-1",
    courseName: "Rédaction",
    sessionsNeeded: 1,
    titulaire: false,
    weeklyMinutes: 45,
    consecutiveSlots: 1,
    preferredDays: ["Lundi", "Mercredi"],
  },
];

for (let i = 0; i < 24; i += 1) {
  const result = placeTeachingsGreedy({
    candidates: components,
    courseSlots,
    durationCourseMinutes: duration,
    occupiedClassSlots: new Set(),
    occupiedTeacherIntervals: new Map(),
    workDays: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"],
  });

  assert(result.failures.length === 0, `composantes essai ${i}: incomplet`);
  const byDay = countByDay(result.placed);
  for (const [day, count] of byDay) {
    assert(
      count <= 2,
      `composantes essai ${i}: ${count} matières le ${day}`,
    );
  }
  assert(
    byDay.size === 2,
    `composantes essai ${i}: répartir sur les 2 jours attachés`,
  );
}

for (let i = 0; i < 24; i += 1) {
  const result = placeTeachingsGreedy({
    candidates: [baseCandidate],
    courseSlots,
    durationCourseMinutes: duration,
    occupiedClassSlots: new Set(),
    occupiedTeacherIntervals: new Map([
      [
        "teacher-1",
        [
          {
            day: "Lundi" as Day,
            startMin: parseHmToMinutes("07:30"),
            endMin: parseHmToMinutes("09:00"),
            label: "Maths · 3e · Branche B",
          },
        ],
      ],
    ]),
    workDays: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"],
  });

  assert(
    result.failures.length === 0,
    `autre branche essai ${i}: placement incomplet`,
  );
  for (const row of result.placed) {
    const start = parseHmToMinutes(row.hourHm);
    const end = start + duration;
    const overlapsOtherBranch =
      row.day === "Lundi" && start < parseHmToMinutes("09:00") && 7 * 60 + 30 < end;
    assert(
      !overlapsOtherBranch,
      `autre branche essai ${i}: chevauche 07:30–09:00 déjà pris dans une autre branche (${row.day} ${row.hourHm})`,
    );
  }
}

console.log("OK schedule auto-generate spread");
console.log("  3 séances + 2 h d'affilée + 2 jours → 2 + 1");
console.log("  3 matières même enseignant → réparties sur les jours attachés");

const angolanSlots = ["07:30", "08:15", "09:00", "10:00", "10:45", "11:30"];
const angolanDays: Day[] = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const angolanCandidates: PlacementCandidate[] = [
  ...[0, 1].map((index) => ({
    teachingId: `bloc180-${index}`,
    teacherId: `teacher-180-${index}`,
    courseName: `Cours 180 ${index + 1}`,
    sessionsNeeded: 4,
    titulaire: false,
    weeklyMinutes: 180,
    consecutiveSlots: 4,
    explicitWeeklyMinutes: true,
  })),
  ...[0, 1].map((index) => ({
    teachingId: `bloc45-${index}`,
    teacherId: `teacher-45-${index}`,
    courseName: `Cours 45 ${index + 1}`,
    sessionsNeeded: 1,
    titulaire: false,
    weeklyMinutes: 45,
    consecutiveSlots: 1,
    explicitWeeklyMinutes: true,
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    teachingId: `bloc90-${index}`,
    teacherId: `teacher-90-${index}`,
    courseName: `Cours 90 ${index + 1}`,
    sessionsNeeded: 2,
    titulaire: false,
    weeklyMinutes: 90,
    consecutiveSlots: 2,
    explicitWeeklyMinutes: true,
  })),
];

{
  const generated = generateCourseStartSlots({
    startTime: "07:30",
    endTime: "12:15",
    durationCourse: 45,
    recreationHour: "09:45",
    recreationDuration: 15,
  });
  assert(
    generated.length === 6,
    `vacation 270 min / 45 → 6 séances, reçu ${generated.length}`,
  );
  assert(
    generated.join(",") === angolanSlots.join(","),
    `grilles différentes: ${generated.join(" ")}`,
  );

  const packed = placeTeachingsWithRetries(
    {
      candidates: angolanCandidates,
      courseSlots: angolanSlots,
      durationCourseMinutes: 45,
      occupiedClassSlots: new Set(),
      occupiedTeacherIntervals: new Map(),
      workDays: angolanDays,
    },
    { maxAttempts: 96 },
  );
  assert(
    packed.placed.length === 30,
    `7a 1350 min: 30 cases attendues, ${packed.placed.length} placées, manquantes=${JSON.stringify(packed.failures)}`,
  );
  assert(packed.failures.length === 0, "7a 1350 min: des cours n'ont pas été casés");
  console.log("OK 7a angolais 270×5 = 1350 : grille 3+3 remplie (4 d'affilée recasés en 3+1)");
}

{
  const afternoonVacation = {
    startTime: "12:30",
    endTime: "17:15",
    recreationHour: "14:45",
    recreationDuration: 15,
    durationCourse: 45,
  };
  const weekdaySlots = generateCourseStartSlotsForDay(
    afternoonVacation,
    "Lundi",
  );
  const saturdaySlots = generateCourseStartSlotsForDay(
    afternoonVacation,
    "Samedi",
  );
  const lunSam: Day[] = [
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ];
  const courseSlotsByDay = Object.fromEntries(
    lunSam.map((day) => [
      day,
      day === "Samedi" ? saturdaySlots : weekdaySlots,
    ]),
  ) as Partial<Record<Day, string[]>>;

  const saturdayPreferred = placeTeachingsGreedy({
    candidates: [
      {
        ...baseCandidate,
        preferredDays: ["Samedi"],
        sessionsNeeded: 2,
        consecutiveSlots: 1,
        weeklyMinutes: 90,
      },
    ],
    courseSlots: weekdaySlots,
    courseSlotsByDay,
    durationCourseMinutes: duration,
    occupiedClassSlots: new Set(),
    occupiedTeacherIntervals: new Map(),
    workDays: lunSam,
  });
  assert(
    saturdayPreferred.failures.length === 0,
    `samedi préféré: placement incomplet ${JSON.stringify(saturdayPreferred.failures)}`,
  );
  assert(
    saturdayPreferred.placed.length === 2,
    `samedi préféré: 2 séances, reçu ${saturdayPreferred.placed.length}`,
  );
  assert(
    saturdayPreferred.placed.every((row) => row.day === "Samedi"),
    "samedi préféré: toutes les séances doivent être le samedi",
  );
  assert(
    saturdayPreferred.placed.every((row) => saturdaySlots.includes(row.hourHm)),
    `samedi après-midi → heures du matin, reçu ${saturdayPreferred.placed.map((row) => row.hourHm).join(" ")}`,
  );
  assert(
    saturdayPreferred.placed.every((row) => !weekdaySlots.includes(row.hourHm)),
    "samedi ne doit pas réutiliser les heures d'après-midi de semaine",
  );

  const spread = placeTeachingsGreedy({
    candidates: [
      {
        ...baseCandidate,
        preferredDays: [],
        sessionsNeeded: 6,
        consecutiveSlots: 1,
        weeklyMinutes: 270,
      },
    ],
    courseSlots: weekdaySlots,
    courseSlotsByDay,
    durationCourseMinutes: duration,
    occupiedClassSlots: new Set(),
    occupiedTeacherIntervals: new Map(),
    workDays: lunSam,
  });
  assert(spread.failures.length === 0, "lun–sam: placement incomplet");
  assert(
    spread.placed.some((row) => row.day === "Samedi"),
    `lun–sam: le samedi doit recevoir au moins une séance, jours=${[...countByDay(spread.placed).keys()].join(",")}`,
  );
  assert(
    spread.placed
      .filter((row) => row.day === "Samedi")
      .every((row) => saturdaySlots.includes(row.hourHm)),
    "lun–sam: les séances du samedi utilisent les heures du matin",
  );
  console.log(
    "OK samedi inclus (après-midi →",
    saturdaySlots.join(" · "),
    ")",
  );
}
