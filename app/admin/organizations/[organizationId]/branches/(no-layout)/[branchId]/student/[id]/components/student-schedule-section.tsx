"use client";

import { CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  STUDENT_SCHEDULE_DAYS,
  type StudentScheduleData,
} from "@/lib/student-schedule-types";
import { normalizeCreneauWorkingDays } from "@/lib/creneau-working-days";
import { slotHourOnDay } from "@/lib/creneau-saturday";
import {
  weekdayLabel,
  weekdayShortLabel,
} from "@/lib/reports/document-locale";
import { normalizeUserLocale } from "@/lib/user-locale";

type StudentScheduleSectionProps = {
  schedule: StudentScheduleData | null;
};

export function StudentScheduleSection({ schedule }: StudentScheduleSectionProps) {
  const t = useTranslations("teaching.schedule");
  const locale = normalizeUserLocale(useLocale());
  const saturdayShort = weekdayShortLabel("Samedi", locale);

  if (!schedule) {
    return (
      <Card className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("emptyReadOnly")}
      </Card>
    );
  }

  const {
    classLabel,
    classCode,
    timeSlots,
    recreationHour,
    endTime,
    entries,
    saturdayTimeSlots = [],
    saturdayEndTime = "",
  } = schedule;
  const days =
    schedule.workingDays?.length > 0
      ? normalizeCreneauWorkingDays(schedule.workingDays)
      : [...STUDENT_SCHEDULE_DAYS];
  const showSaturdayClock = saturdayTimeSlots.some(
    (hour, index) => hour !== timeSlots[index],
  );

  return (
    <Card className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="size-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">{t("weeklyTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {classLabel}
            {classCode ? ` · ${classCode}` : ""}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">{t("hoursColumn")}</TableHead>
              {days.map((day) => (
                <TableHead key={day}>
                  {weekdayLabel(day, locale)}
                  {showSaturdayClock && day === "Samedi" ? (
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                      07:30 – {saturdayEndTime || "12:30"}
                    </span>
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeSlots.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={days.length + 1}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucun horaire disponible pour cette classe.
                </TableCell>
              </TableRow>
            ) : (
              timeSlots.map((hour, index) =>
                hour === recreationHour ? (
                  <TableRow key={`recreation-${hour}`}>
                    <TableCell
                      colSpan={days.length + 1}
                      className="text-center"
                    >
                      <span className="text-base tracking-widest text-muted-foreground">
                        {t("pdf.recreation")} ({hour} -{" "}
                        {timeSlots[index + 1] || endTime})
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={hour}>
                    <TableCell className="font-medium">
                      <span>{`${hour} - ${timeSlots[index + 1] || endTime}`}</span>
                      {showSaturdayClock && saturdayTimeSlots[index] ? (
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          {saturdayShort} {saturdayTimeSlots[index]} -{" "}
                          {saturdayTimeSlots[index + 1] ||
                            saturdayEndTime ||
                            endTime}
                        </span>
                      ) : null}
                    </TableCell>
                    {days.map((day) => {
                      const cellHour = slotHourOnDay({
                        day,
                        weekdaySlot: hour,
                        weekdaySlots: timeSlots,
                        saturdaySlots: saturdayTimeSlots,
                      });
                      const cellEntries = entries.filter(
                        (entry) =>
                          entry.day === day && entry.hourStart === cellHour,
                      );

                      return (
                        <TableCell
                          key={`${day}-${hour}`}
                          className={
                            cellEntries.length > 1
                              ? "bg-destructive/10 text-destructive"
                              : undefined
                          }
                        >
                          {cellEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="border-b py-1 last:border-b-0"
                            >
                              <p className="font-medium">{entry.courseName}</p>
                              {entry.teacherName ? (
                                <p className="text-xs text-muted-foreground">
                                  {entry.teacherName}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ),
              )
            )}

            {endTime && timeSlots.length > 0 ? (
              <TableRow className="bg-muted/40">
                <TableCell
                  colSpan={days.length + 1}
                  className="py-3 text-center text-sm font-semibold"
                >
                  FIN DES COURS · {endTime}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {entries.length === 0 && timeSlots.length > 0 ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Aucun cours planifie pour le moment.
        </p>
      ) : null}
    </Card>
  );
}
