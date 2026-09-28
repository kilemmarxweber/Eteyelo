"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_CRENEAU_WORKING_DAYS } from "@/lib/creneau-working-days";
import { slotHourOnDay } from "@/lib/creneau-saturday";
import { cn } from "@/lib/utils";
import type { GlobalScheduleEntry } from "./types";
import {
  intlLocaleFromUnknown,
  weekdayLabel,
  weekdayShortLabel,
} from "@/lib/reports/document-locale";
import { normalizeUserLocale } from "@/lib/user-locale";

function normalizeHm(value: string) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value ?? "").trim();
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = normalizeHm(value).split(":").map(Number);
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
  saturdayHours?: string[];
  saturdayEndTime?: string;
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
  saturdayHours = [],
  saturdayEndTime = "",
  entries,
  showTeacher = true,
  emptyLabel,
  hoursLabel,
  recreationLabel,
}: GlobalScheduleGridProps) {
  const locale = normalizeUserLocale(useLocale());
  const saturdayShort = weekdayShortLabel("Samedi", locale);
  const collator = intlLocaleFromUnknown(locale);

  const days = useMemo(() => {
    const base =
      workingDays && workingDays.length > 0
        ? workingDays
        : DEFAULT_CRENEAU_WORKING_DAYS;
    const entryDays = new Set(
      entries.map((entry) => entry.day).filter(Boolean),
    );
    const ordered = DEFAULT_CRENEAU_WORKING_DAYS.filter(
      (day) => base.includes(day) || entryDays.has(day),
    );
    if (ordered.length > 0) return ordered;
    return [...entryDays];
  }, [workingDays, entries]);

  const displayHours = useMemo(() => {
    const unique = new Set<string>();
    for (const hour of hours) {
      const n = normalizeHm(hour);
      if (n) unique.add(n);
    }
    // Toujours inclure les heures des séances (rotation atelier, etc.).
    for (const entry of entries) {
      const n = normalizeHm(entry.hour);
      if (n) unique.add(n);
    }
    const recreation = normalizeHm(recreationHour);
    if (recreation) unique.add(recreation);
    return Array.from(unique).sort(
      (a, b) => timeToMinutes(a) - timeToMinutes(b),
    );
  }, [hours, recreationHour, entries]);

  const saturdayDisplayHours = saturdayHours.map(normalizeHm).filter(Boolean);
  const showSaturdayClock =
    saturdayDisplayHours.length > 0 &&
    saturdayDisplayHours.some((hour, index) => hour !== displayHours[index]);

  const hourOnDay = (day: string, weekdayHour: string) =>
    normalizeHm(
      slotHourOnDay({
        day,
        weekdaySlot: weekdayHour,
        weekdaySlots: displayHours,
        saturdaySlots: saturdayDisplayHours,
      }),
    );

  const entriesByCell = useMemo(() => {
    const map = new Map<string, GlobalScheduleGridEntry[]>();
    for (const entry of entries) {
      const key = `${entry.day}|${normalizeHm(entry.hour)}`;
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          a.teacher.name.localeCompare(b.teacher.name, collator) ||
          a.classe.codeClasse.localeCompare(b.classe.codeClasse, collator) ||
          a.cours.nameCours.localeCompare(b.cours.nameCours, collator),
      );
    }
    return map;
  }, [entries, collator]);

  const recreationNorm = normalizeHm(recreationHour);
  const entryHoursSet = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      const n = normalizeHm(entry.hour);
      if (n) set.add(n);
    }
    return set;
  }, [entries]);

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">{hoursLabel}</TableHead>
            {days.map((day) => (
              <TableHead key={day} className="min-w-[140px] text-center">
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
          {displayHours.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={Math.max(days.length, 1) + 1}
                className="text-center text-muted-foreground"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            displayHours.map((heure, index) => {
              // Ne pas masquer un cours placé pile à l'heure de récréation.
              const isRecreationRow =
                Boolean(recreationNorm) &&
                heure === recreationNorm &&
                !entryHoursSet.has(heure);

              if (isRecreationRow) {
                return (
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
                        {showSaturdayClock && saturdayDisplayHours[index]
                          ? ` · ${saturdayShort} ${saturdayDisplayHours[index]} – ${
                              saturdayDisplayHours[index + 1] ||
                              saturdayEndTime ||
                              endTime
                            }`
                          : ""}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow key={heure}>
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    <span>
                      {formatSlotRange(heure, displayHours, index, endTime)}
                    </span>
                    {showSaturdayClock && saturdayDisplayHours[index] ? (
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                        {saturdayShort}{" "}
                        {formatSlotRange(
                          saturdayDisplayHours[index]!,
                          saturdayDisplayHours,
                          index,
                          saturdayEndTime || endTime,
                        )}
                      </span>
                    ) : null}
                  </TableCell>
                  {days.map((day) => {
                    const cellHour = hourOnDay(day, heure);
                    const cellEntries =
                      entriesByCell.get(`${day}|${cellHour}`) ??
                      entriesByCell.get(`${day}|${heure}`) ??
                      [];
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
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
