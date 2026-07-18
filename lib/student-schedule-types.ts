export const STUDENT_SCHEDULE_DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

export type StudentScheduleEntry = {
  id: string;
  day: string;
  hourStart: string;
  courseName: string;
  teacherName: string;
};

export type StudentScheduleData = {
  classLabel: string;
  classCode: string;
  timeSlots: string[];
  recreationHour: string;
  endTime: string;
  entries: StudentScheduleEntry[];
};
