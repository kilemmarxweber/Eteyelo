import type {
  GlobalScheduleByCycle,
  GlobalScheduleTeacher,
} from "./types";
import type { GlobalSchedulePdfTable } from "./export-global-schedule-pdf";
import { teacherScheduleClock } from "./saturday-clock";

export function teacherSchedulePdfTable(
  teacher: GlobalScheduleTeacher,
  schedule: GlobalScheduleByCycle,
  meta: string,
): GlobalSchedulePdfTable {
  const teacherCreneaux =
    teacher.creneauIds.length > 0
      ? schedule.creneaux.filter((creneau) =>
          teacher.creneauIds.includes(creneau.id),
        )
      : schedule.creneaux;
  const clock = teacherScheduleClock({
    teacherCreneaux,
    fallbackHours: teacher.entries.map((entry) => entry.hour),
    allCreneaux: schedule.creneaux,
  });
  return {
    title: teacher.name,
    subtitle: meta,
    hours: clock.hours,
    workingDays: clock.workingDays,
    recreationHour: clock.recreationHour,
    endTime: clock.endTime,
    saturdayHours: clock.saturdayHours,
    saturdayEndTime: clock.saturdayEndTime,
    entries: teacher.entries,
    showTeacher: false,
  };
}
