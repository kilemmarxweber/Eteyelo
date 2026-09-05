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
  classeCount: number;
};

export type GlobalScheduleTeacher = {
  id: string;
  nom: string;
  postnom: string;
  prenom: string;
  name: string;
  classCount: number;
  courseCount: number;
  periodCount: number;
  creneauIds: string[];
  entries: GlobalScheduleEntry[];
};

export type GlobalScheduleByCycle = {
  cycle: Cycle;
  cycleLabel: string;
  classCount: number;
  courseCount: number;
  teacherCount: number;
  periodCount: number;
  classesWithoutCreneau: number;
  creneaux: GlobalScheduleCreneau[];
  teachers: GlobalScheduleTeacher[];
  entries: GlobalScheduleEntry[];
};
