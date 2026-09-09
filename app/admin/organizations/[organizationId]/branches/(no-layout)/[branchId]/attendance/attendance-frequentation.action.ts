"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { requireAttendanceScanContext } from "@/lib/auth/attendance-kiosk-context";
import { listBranchClosedDayKeys } from "@/lib/branch-closed-days";
import { getAppWeekday, nowLocal, startOfTodayParis } from "@/lib/timezone";
import {
  buildObservation,
  formatFrequentationTime,
  frequentationMark,
  type FrequentationAverageRow,
  type FrequentationDayCell,
  type FrequentationMonthPage,
  type FrequentationRegister,
  type FrequentationStudentRow,
} from "@/lib/attendance-frequentation-register";

const MONTH_LABELS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function personName(user: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  if (!user) return "—";
  return (
    [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim() ||
    "—"
  );
}

function calendarDayIso(date: Date): string {
  return startOfTodayParis(date).toISOString().slice(0, 10);
}

function schoolYearMonths(start: Date, end: Date): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  const cursor = startOfTodayParis(start);
  cursor.setUTCDate(1);
  const last = startOfTodayParis(end);
  last.setUTCDate(1);
  while (cursor.getTime() <= last.getTime()) {
    months.push({
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function isSunday(date: Date): boolean {
  return getAppWeekday(date) === 0;
}

export const getStudentFrequentationRegisterAction = action
  .input(
    z.object({
      classeId: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }): Promise<FrequentationRegister> => {
    const { branchId } = await requireAttendanceScanContext();
    const now = nowLocal();
    const todayIso = calendarDayIso(now);

    const schoolYear = await prisma.schoolYear.findFirst({
      where: { branchId, isCurrentYear: true },
      select: {
        id: true,
        nameYear: true,
        startYear: true,
        endYear: true,
      },
    });
    if (!schoolYear) {
      throw new Error("Aucune année scolaire en cours.");
    }

    const classeId = input.classeId?.trim() || null;
    let classeName: string | null = null;
    if (classeId) {
      const classe = await prisma.classe.findFirst({
        where: { id: classeId, branchId },
        select: { nameClasse: true, codeClasse: true },
      });
      classeName =
        classe?.nameClasse?.trim() || classe?.codeClasse?.trim() || null;
    }

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        branchId,
        schoolYearId: schoolYear.id,
        OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
        ...(classeId ? { classeId } : {}),
      },
      select: {
        studentId: true,
        classe: {
          select: { id: true, nameClasse: true, codeClasse: true },
        },
        student: {
          select: {
            id: true,
            branchMember: {
              select: {
                member: {
                  select: {
                    user: {
                      select: { name: true, postnom: true, prenom: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      distinct: ["studentId"],
    });

    const start = startOfTodayParis(schoolYear.startYear);
    const endDay = startOfTodayParis(schoolYear.endYear);
    const queryEnd = new Date(endDay);
    queryEnd.setUTCHours(23, 59, 59, 999);
    const closedDays = await listBranchClosedDayKeys(
      branchId,
      start,
      new Date(queryEnd.getTime() + 1),
    );

    const attendance = await prisma.studentAttendance.findMany({
      where: {
        branchId,
        session: {
          date: { gte: start, lte: queryEnd },
          ...(classeId ? { teaching: { classeId } } : {}),
        },
      },
      select: {
        studentId: true,
        status: true,
        checkIn: true,
        checkOut: true,
        earlyExit: true,
        exitReason: true,
        exitReasonCode: true,
        recordedAt: true,
        session: { select: { date: true } },
      },
    });

    const byStudentDay = new Map<
      string,
      {
        statuses: string[];
        checkIns: Date[];
        checkOuts: Date[];
        earlyExit: boolean;
        exitReason: string | null;
        exitReasonCode: string | null;
      }
    >();

    for (const row of attendance) {
      const dayKey = `${row.studentId}:${calendarDayIso(row.session.date)}`;
      const entry = byStudentDay.get(dayKey) ?? {
        statuses: [],
        checkIns: [],
        checkOuts: [],
        earlyExit: false,
        exitReason: null,
        exitReasonCode: null,
      };
      entry.statuses.push(row.status);
      if (row.checkIn) entry.checkIns.push(row.checkIn);
      if (row.checkOut) entry.checkOuts.push(row.checkOut);
      if (row.earlyExit) entry.earlyExit = true;
      if (row.exitReason) entry.exitReason = row.exitReason;
      if (row.exitReasonCode) entry.exitReasonCode = row.exitReasonCode;
      byStudentDay.set(dayKey, entry);
    }

    const students = enrollments
      .flatMap((enrollment) => {
        const student = enrollment.student;
        if (!student) return [];
        return [
          {
            id: student.id,
            name: personName(student.branchMember?.member?.user ?? null),
            classeName:
              enrollment.classe?.nameClasse?.trim() ||
              enrollment.classe?.codeClasse?.trim() ||
              "Classe",
          },
        ];
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    const monthSpecs = schoolYearMonths(schoolYear.startYear, schoolYear.endYear);
    const months: FrequentationMonthPage[] = [];
    let classDaysYear = 0;
    let presenceYear = 0;
    const averages: FrequentationAverageRow[] = [];

    for (const spec of monthSpecs) {
      const dim = daysInUtcMonth(spec.year, spec.month);
      let openDays = 0;
      const studentRows: FrequentationStudentRow[] = students.map((student) => ({
        personId: student.id,
        personName: student.name,
        days: [],
        presentCount: 0,
        absentCount: 0,
        arrival: null,
        departure: null,
        observation: null,
      }));

      for (let day = 1; day <= dim; day += 1) {
        const date = utcDay(spec.year, spec.month, day);
        const iso = calendarDayIso(date);
        const schoolDay = !isSunday(date) && !closedDays.has(iso);
        const isFuture = iso > todayIso;
        if (schoolDay && iso <= todayIso) openDays += 1;

        studentRows.forEach((row) => {
          const entry = byStudentDay.get(`${row.personId}:${iso}`);
          const checkIns = [...(entry?.checkIns ?? [])].sort(
            (a, b) => a.getTime() - b.getTime(),
          );
          const checkOuts = [...(entry?.checkOuts ?? [])].sort(
            (a, b) => a.getTime() - b.getTime(),
          );
          const checkIn = checkIns[0] ?? null;
          const checkOut = checkOuts[checkOuts.length - 1] ?? null;
          const status = entry?.statuses.includes("LATE")
            ? "LATE"
            : entry?.statuses.includes("PRESENT")
              ? "PRESENT"
              : entry?.statuses.includes("EXCUSED")
                ? "EXCUSED"
                : entry?.statuses[0] ?? null;
          const mark = frequentationMark({
            schoolDay,
            isFuture,
            checkIn,
            status,
            exitReasonCode: entry?.exitReasonCode,
            exitReason: entry?.exitReason,
          });
          const cell: FrequentationDayCell = {
            day,
            iso,
            schoolDay,
            mark,
          };
          row.days.push(cell);
          if (mark === "I") row.presentCount += 1;
          if (mark === "O" || mark === "M" || mark === "R") row.absentCount += 1;
          if (mark || checkIn || checkOut) {
            const arrival = formatFrequentationTime(checkIn);
            const departure = formatFrequentationTime(checkOut);
            if (arrival) row.arrival = arrival;
            if (departure) row.departure = departure;
            row.observation = buildObservation({
              arrival,
              departure,
              earlyExit: Boolean(entry?.earlyExit),
              exitReason: entry?.exitReason ?? null,
            });
          }
        });
      }

      const presenceMonth = studentRows.reduce(
        (sum, row) => sum + row.presentCount,
        0,
      );
      classDaysYear += openDays;
      presenceYear += presenceMonth;
      const averageAttendance =
        classDaysYear > 0 ? Math.round((presenceYear / classDaysYear) * 10) / 10 : null;

      months.push({
        year: spec.year,
        month: spec.month,
        monthLabel: MONTH_LABELS_FR[spec.month - 1] ?? String(spec.month),
        daysInMonth: dim,
        openDays,
        students: studentRows,
        presenceMonth,
        presencePrevious: presenceYear - presenceMonth,
        classDaysPrevious: classDaysYear - openDays,
        averageAttendance,
      });

      averages.push({
        month: spec.month,
        year: spec.year,
        monthLabel: MONTH_LABELS_FR[spec.month - 1] ?? String(spec.month),
        enrolled: students.length,
        classDaysMonth: openDays,
        classDaysYear,
        presenceMonth,
        presenceYear,
        average: averageAttendance,
      });
    }

    return {
      schoolYearLabel: schoolYear.nameYear,
      classeId,
      classeName,
      months,
      averages,
    };
  });
