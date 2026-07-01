"use client";

import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* =========================
   TYPES
========================= */
export type TeacherScheduleUI = {
  id: string;
  cours: { nameCours: string } | null;
  classe: { codeClasse: string } | null;
  Schedule: {
    id: string;
    day: string;
    hour: Date;
  }[];
};

type Props = {
  teaching?: TeacherScheduleUI[];
  hoursFromProps?: string[];
};

/* =========================
   DAYS
========================= */
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/* =========================
   FORMAT HOUR
========================= */
function formatHour(hour: Date) {
  const d = new Date(hour);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().substring(11, 16);
}

/* =========================
   GET END HOUR (NEW)
========================= */
function getEndHour(start: string, duration = 60) {
  const [h, m] = start.split(":").map(Number);

  const totalMinutes = h * 60 + m + duration;
  console.log(totalMinutes);

  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");

  return `${hh}:${mm}`;
}

/* =========================
   COMPONENT
========================= */
export default function TeacherScheduleTable({
  teaching = [],
  hoursFromProps = [],
}: Props) {
  /* =========================
     FLATTEN SCHEDULE
  ========================= */
  const COURSE_DURATION = 45;
  const schedules = useMemo(() => {
    const list: {
      day: string;
      hourStart: string;
      hourEnd: string;
      cours: string;
      classe: string;
    }[] = [];

    if (!Array.isArray(teaching)) return list;

    teaching.forEach((t) => {
      t.Schedule?.forEach((s) => {
        const start = formatHour(s.hour);

        const end = getEndHour(start, COURSE_DURATION); // 👈 TU PEUX METTRE duration dynamique plus tard

        list.push({
          day: s.day,
          hourStart: start,
          hourEnd: end,
          cours: t.cours?.nameCours ?? "—",
          classe: t.classe?.codeClasse ?? "—",
        });
      });
    });

    return list;
  }, [teaching]);

  /* =========================
     UNIQUE HOURS
  ========================= */
  const hours = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => set.add(s.hourStart));
    return Array.from(set).sort();
  }, [schedules]);

  /* =========================
     GET CELL
  ========================= */
  const getCell = (day: string, hour: string) =>
    schedules.find((s) => s.day === day && s.hourStart === hour);

  return (
    <Card className="p-4 rounded-xl overflow-auto">
      <Table>
        {/* HEADER */}
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Heures</TableHead>
            {DAYS.map((day) => (
              <TableHead key={day} className="text-center">
                {day}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        {/* BODY */}
        <TableBody>
          {hours.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500">
                Aucun emploi du temps
              </TableCell>
            </TableRow>
          ) : (
            hours.map((hour) => (
              <TableRow key={hour}>
                {/* TIME RANGE */}
                <TableCell className="font-semibold text-gray-700">
                  {hour}{" "}
                  <span className="text-gray-400">
                    → {getEndHour(hour, COURSE_DURATION)}
                  </span>
                </TableCell>

                {/* DAYS */}
                {DAYS.map((day) => {
                  const cell = getCell(day, hour);

                  return (
                    <TableCell key={`${day}-${hour}`} className="h-14">
                      {cell && (
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {cell.cours}
                          </p>
                          <p className="text-xs text-gray-500">{cell.classe}</p>
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
