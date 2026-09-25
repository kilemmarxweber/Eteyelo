import type { Cycle } from "@/lib/cycle";

export type GlobalScheduleCycleOption = {
  value: Cycle;
  label: string;
};

export type GlobalScheduleEntry = {
  id: string;
  day: string;
  hour: string;
  teacher: {
    id: string;
    nom: string;
    postnom: string;
    prenom: string;
    name: string;
    telephone: string;
  };
  classe: {
    id: string;
    codeClasse: string;
    nameClasse: string;
  };
  cours: {
    id: string;
    codeCours: string;
    nameCours: string;
  };
  creneauId: string | null;
};

export type GlobalScheduleCreneau = {
  id: string;
  nameCreneau: string;
  startTime: string;
  endTime: string;
  durationCourse: number;
  recreationHour: string;
  recreationDuration: number;
  workingDays: string[];
  slots: string[];
  saturdaySlots?: string[];
  saturdayEndTime?: string;
  classeCount: number;
};

export type GlobalScheduleTeacher = {
  id: string;
  nom: string;
  postnom: string;
  prenom: string;
  name: string;
  telephone: string;
  classCount: number;
  courseCount: number;
  /** Créneaux hebdomadaires planifiés (lignes d'horaire). */
  periodCount: number;
  /** Minutes totales (Σ durée séance du créneau). */
  totalMinutes: number;
  /** Heures de charge = totalMinutes / unité (30 primaire, 45 secondaire). */
  hoursCount: number;
  hoursLabel: string;
  /** Périodes de notation du cycle (6 primaire, 4 secondaire…). */
  academicPeriodCount: number;
  /** Trimestres / semestres du cycle. */
  academicGroupCount: number;
  academicGroupKind: "trimester" | "semester" | "module" | "session";
  creneauIds: string[];
  entries: GlobalScheduleEntry[];
};

export type GlobalScheduleByCycle = {
  cycle: Cycle;
  cycleLabel: string;
  classCount: number;
  courseCount: number;
  teacherCount: number;
  /** Créneaux hebdomadaires du cycle. */
  periodCount: number;
  totalMinutes: number;
  hoursCount: number;
  hoursLabel: string;
  academicPeriodCount: number;
  academicGroupCount: number;
  academicGroupKind: "trimester" | "semester" | "module" | "session";
  hourUnitMinutes: number;
  classesWithoutCreneau: number;
  creneaux: GlobalScheduleCreneau[];
  teachers: GlobalScheduleTeacher[];
  entries: GlobalScheduleEntry[];
};
