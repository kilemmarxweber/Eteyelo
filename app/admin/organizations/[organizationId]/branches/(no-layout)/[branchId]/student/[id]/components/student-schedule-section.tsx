"use client";

import { CalendarClock } from "lucide-react";

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

type StudentScheduleSectionProps = {
  schedule: StudentScheduleData | null;
};

export function StudentScheduleSection({ schedule }: StudentScheduleSectionProps) {
  if (!schedule) {
    return (
      <Card className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucune classe assignee pour afficher l&apos;horaire de cours.
      </Card>
    );
  }

  const { classLabel, classCode, timeSlots, recreationHour, endTime, entries } =
    schedule;

  return (
    <Card className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="size-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">Horaire de cours</h3>
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
              <TableHead className="w-[150px]">Heures</TableHead>
              {STUDENT_SCHEDULE_DAYS.map((day) => (
                <TableHead key={day}>{day}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeSlots.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={STUDENT_SCHEDULE_DAYS.length + 1}
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
                      colSpan={STUDENT_SCHEDULE_DAYS.length + 1}
                      className="text-center"
                    >
                      <span className="text-base tracking-widest text-muted-foreground">
                        R E C R E A T I O N ({hour} -{" "}
                        {timeSlots[index + 1] || endTime})
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={hour}>
                    <TableCell className="font-medium">
                      {`${hour} - ${timeSlots[index + 1] || endTime}`}
                    </TableCell>
                    {STUDENT_SCHEDULE_DAYS.map((day) => {
                      const cellEntries = entries.filter(
                        (entry) => entry.day === day && entry.hourStart === hour,
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
                  colSpan={STUDENT_SCHEDULE_DAYS.length + 1}
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
