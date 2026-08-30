import type { Day } from "../prisma/generated/prisma/client";
import {
  maxSessionsPerSpreadDay,
  parseHmToMinutes,
  placeTeachingsGreedy,
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
