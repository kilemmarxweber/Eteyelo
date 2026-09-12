import {
  inferVacationCycle,
  vacationBelongsToCycle,
} from "../lib/creneau-cycle";
import { PRIMARY_CRENEAU_WORKING_DAYS } from "../lib/creneau-working-days";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const primaryMorning = {
  nameCreneau: "Horaire primaire matin",
  durationCourse: 40,
  workingDays: [...PRIMARY_CRENEAU_WORKING_DAYS],
};

assert(
  inferVacationCycle(primaryMorning) === "PRIMAIRE",
  "preset primaire matin → PRIMAIRE",
);
assert(
  vacationBelongsToCycle(primaryMorning, "SECONDAIRE") === false,
  "primaire matin ne sort pas sur l'horaire secondaire",
);
assert(
  vacationBelongsToCycle(primaryMorning, "PRIMAIRE") === true,
  "primaire matin reste sur l'horaire primaire",
);
assert(
  vacationBelongsToCycle(primaryMorning, "MATERNELLE") === true,
  "primaire matin reste visible en maternelle",
);

assert(
  inferVacationCycle({
    nameCreneau: "Horário primário manhã",
    durationCourse: 40,
    workingDays: [...PRIMARY_CRENEAU_WORKING_DAYS],
  }) === "PRIMAIRE",
  "libellé PT primário → PRIMAIRE",
);
assert(
  inferVacationCycle({ nameCreneau: "Primary morning schedule" }) ===
    "PRIMAIRE",
  "libellé EN primary → PRIMAIRE",
);

assert(
  inferVacationCycle({
    nameCreneau: "Matin 1",
    durationCourse: 40,
    workingDays: [...PRIMARY_CRENEAU_WORKING_DAYS],
  }) === "PRIMAIRE",
  "40 min lun–ven sans libellé → PRIMAIRE",
);

assert(
  inferVacationCycle({
    nameCreneau: "Horaire standard matin",
    durationCourse: 45,
    workingDays: [
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ],
  }) === null,
  "horaire standard secondaire reste générique",
);
assert(
  vacationBelongsToCycle(
    { nameCreneau: "Horaire standard matin", durationCourse: 45 },
    "SECONDAIRE",
  ) === true,
  "horaire standard matin reste sur le secondaire",
);

assert(
  vacationBelongsToCycle(
    { nameCreneau: "Horaire secondaire après-midi" },
    "PRIMAIRE",
  ) === false,
  "vacation secondaire ne sort pas sur le primaire",
);

console.log("OK creneau-cycle: primaire matin exclu de l'horaire secondaire");
