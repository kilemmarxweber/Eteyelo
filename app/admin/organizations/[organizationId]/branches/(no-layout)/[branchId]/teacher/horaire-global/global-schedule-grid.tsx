"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_CRENEAU_WORKING_DAYS } from "@/lib/creneau-working-days";
import { cn } from "@/lib/utils";
import type { GlobalScheduleEntry } from "./types";

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function formatSlotRange(
  heure: string,
  displaySlots: string[],
  index: number,
  endTime: string,
) {
  return `${heure} – ${displaySlots[index + 1] || endTime}`;
}

export type GlobalScheduleGridEntry = Pick<
  GlobalScheduleEntry,
  "id" | "day" | "hour" | "teacher" | "classe" | "cours"
>;

type GlobalScheduleGridProps = {
  hours: string[];
  workingDays?: string[];
  recreationHour?: string;
  endTime?: string;
  entries: GlobalScheduleGridEntry[];
  showTeacher?: boolean;
  emptyLabel: string;
  hoursLabel: string;
  recreationLabel: (start: string, end: string) => string;
};

export function GlobalScheduleGrid({
  hours,
  workingDays,
  recreationHour = "",
  endTime = "",
  entries,
  showTeacher = true,
  emptyLabel,
  hoursLabel,
  recreationLabel,
}: GlobalScheduleGridProps) {
  const days =
    workingDays && workingDays.length > 0
      ? workingDays
      : DEFAULT_CRENEAU_WORKING_DAYS;

  const displayHours = useMemo(() => {
    const unique = new Set(hours.filter(Boolean));
    if (recreationHour) unique.add(recreationHour);
    return Array.from(unique).sort(
      (a, b) => timeToMinutes(a) - timeToMinutes(b),
    );
  }, [hours, recreationHour]);

  const entriesByCell = useMemo(() => {
    const map = new Map<string, GlobalScheduleGridEntry[]>();
    for (const entry of entries) {
      const key = `${entry.day}|${entry.hour}`;
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          a.teacher.name.localeCompare(b.teacher.name, "fr") ||
          a.classe.codeClasse.localeCompare(b.classe.codeClasse, "fr") ||
          a.cours.nameCours.localeCompare(b.cours.nameCours, "fr"),
      );
    }
    return map;
  }, [entries]);

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">{hoursLabel}</TableHead>
            {days.map((day) => (
              <TableHead key={day} className="min-w-[140px] text-center">
                {day}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayHours.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={days.length + 1}
                className="text-center text-muted-foreground"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            displayHours.map((heure, index) =>
              recreationHour && heure === recreationHour ? (
                <TableRow key={`recreation-${heure}`}>
                  <TableCell
                    colSpan={days.length + 1}
                    className="bg-muted/40 text-center"
                  >
                    <span className="text-sm font-medium tracking-wide text-muted-foreground">
                      {recreationLabel(
                        heure,
                        displayHours[index + 1] || endTime,
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={heure}>
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    {formatSlotRange(heure, displayHours, index, endTime)}
                  </TableCell>
                  {days.map((day) => {
                    const cellEntries =
                      entriesByCell.get(`${day}|${heure}`) ?? [];
                    const crowded = showTeacher
                      ? cellEntries.length > 4
                      : cellEntries.length > 1;

                    return (
                      <TableCell
                        key={`${day}-${heure}`}
                        className={cn(
                          "align-top",
                          crowded && "bg-destructive/10",
                        )}
                      >
                        <div className="flex flex-col gap-1">
                          {cellEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-md bg-primary/5 px-2 py-1.5 text-xs"
                            >
                              {showTeacher ? (
                                <p className="font-semibold text-foreground">
                                  {entry.teacher.name}
                                </p>
                              ) : null}
                              <p
                                className={cn(
                                  "font-medium text-foreground",
                                  showTeacher && "font-normal",
                                )}
                              >
                                {entry.cours.nameCours}
                              </p>
                              <p className="text-muted-foreground">
                                {entry.classe.codeClasse ||
                                  entry.classe.nameClasse}
                              </p>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ),
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
