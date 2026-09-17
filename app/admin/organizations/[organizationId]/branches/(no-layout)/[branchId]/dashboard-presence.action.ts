"use server";

import { z } from "zod";

import { action } from "@/lib/zsa";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  getPersonnelIdForUser,
  getTeacherIdForUser,
} from "@/lib/auth/data-scope";
import { assertWithinBranchAttendanceRadius } from "@/lib/attendance-geo.server";
import { afterPersonnelAttendanceWrite } from "@/lib/attendance-absence";
import {
  isBranchClosedOn,
  resolvePersonnelStatusFromSchedule,
} from "@/lib/branch-closed-days";
import {
  calendarDateKey,
  DEFAULT_PERSONNEL_DAY_MINUTES,
  emptyPresenceSeries,
  isPresentLikeStatus,
  personnelWorkedHours,
  presenceChartRange,
  type PresenceChartStats,
} from "@/lib/presence-session-chart";
import { nowLocal, startOfTodayParis } from "@/lib/timezone";
import { checkTeacherAttendanceNeeded } from "./attendance/attendance.action";

import { attendanceGeoCoordsSchema as geoSchema } from "@/lib/attendance-geo-schema";

export type PresenceMonthSummary = {
  present: number;
  late: number;
  absent: number;
  total: number;
};

export type DashboardTeacherPresence = {
  id: string;
  pending: {
    teacherId: string;
    sessionId: string;
    cours: string | null;
    classe: string | null;
  } | null;
  month: PresenceMonthSummary;
  chart: PresenceChartStats;
};

export type DashboardPersonnelPresence = {
  id: string;
  today: {
    status: string;
    checkIn: string | null;
    checkOut: string | null;
  } | null;
  month: PresenceMonthSummary;
  chart: PresenceChartStats;
  dayHours: number;
};

export type DashboardPresenceData = {
  teacher: DashboardTeacherPresence | null;
  personnel: DashboardPersonnelPresence | null;
};

function emptyMonth(): PresenceMonthSummary {
  return { present: 0, late: 0, absent: 0, total: 0 };
}

function bump(summary: PresenceMonthSummary, status: string) {
  summary.total += 1;
  if (status === "PRESENT") summary.present += 1;
  else if (status === "LATE") summary.late += 1;
  else if (status === "ABSENT") summary.absent += 1;
}

function monthRange() {
  const now = nowLocal();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function ensureMyStaffPresenceProfiles(userId: string, branchId: string) {
  const branchMember = await prisma.branchMember.findFirst({
    where: { branchId, isActive: true, member: { userId } },
    select: {
      id: true,
      role: true,
      personel: { select: { id: true, isActive: true }, take: 1 },
      teacher: { select: { id: true, isActive: true }, take: 1 },
    },
  });
  if (!branchMember) return;

  const staffRoles = new Set(["DIRECTOR", "ADMIN", "CAISSIER"]);
  if (staffRoles.has(branchMember.role)) {
    const existing = branchMember.personel[0];
    if (!existing) {
      await prisma.personnel.create({
        data: { branchMemberId: branchMember.id, isActive: true },
      });
    } else if (!existing.isActive) {
      await prisma.personnel.update({
        where: { id: existing.id },
        data: { isActive: true, deactivatedAt: null },
      });
    }
  }

  if (branchMember.role === "TEACHER") {
    const existing = branchMember.teacher[0];
    if (!existing) {
      await prisma.teacher.create({
        data: { branchMemberId: branchMember.id, isActive: true },
      });
    } else if (!existing.isActive) {
      await prisma.teacher.update({
        where: { id: existing.id },
        data: { isActive: true, deactivatedAt: null },
      });
    }
  }
}

export const getMyDashboardPresenceAction = action.handler(
  async (): Promise<DashboardPresenceData> => {
    const { branchId, organizationId, userId } = await requireBranchContext();
    const { start, end } = monthRange();

    await ensureMyStaffPresenceProfiles(userId, branchId);

    const [teacherId, personnelId] = await Promise.all([
      getTeacherIdForUser(userId, branchId),
      getPersonnelIdForUser(userId, branchId),
    ]);

    const chartRange = presenceChartRange();
    const now = nowLocal();

    let teacher: DashboardTeacherPresence | null = null;
    if (teacherId) {
      const [records, chartRows, pending] = await Promise.all([
        prisma.teacherAttendance.findMany({
          where: {
            branchId,
            teacherId,
            date: { gte: start, lte: end },
          },
          select: { status: true },
        }),
        prisma.teacherAttendance.findMany({
          where: {
            branchId,
            teacherId,
            date: { gte: chartRange.start, lte: chartRange.end },
          },
          select: { date: true, status: true },
        }),
        checkTeacherAttendanceNeeded({ organizationId, branchId }),
      ]);
      const month = emptyMonth();
      for (const record of records) bump(month, record.status);
      const series = emptyPresenceSeries(chartRange.keys);
      const byDate = new Map(series.map((item) => [item.date, item]));
      let weekPresent = 0;
      let todayPresent = 0;
      for (const row of chartRows) {
        if (!isPresentLikeStatus(row.status)) continue;
        const key = calendarDateKey(row.date);
        const bucket = byDate.get(key);
        if (!bucket) continue;
        bucket.count += 1;
        weekPresent += 1;
        if (key === chartRange.todayKey) todayPresent += 1;
      }
      teacher = {
        id: teacherId,
        pending:
          pending?.sessionId && pending.teacherId === teacherId
            ? {
                teacherId: pending.teacherId,
                sessionId: pending.sessionId,
                cours: pending.cours,
                classe: pending.classe,
              }
            : null,
        month,
        chart: {
          todayCount: todayPresent,
          totalCount: weekPresent,
          series,
        },
      };
    }

    let personnel: DashboardPersonnelPresence | null = null;
    if (personnelId) {
      const today = startOfTodayParis();
      const [records, todayRow, chartRows, policy] = await Promise.all([
        prisma.personnelAttendance.findMany({
          where: {
            branchId,
            personnelId,
            date: { gte: start, lte: end },
          },
          select: { status: true },
        }),
        prisma.personnelAttendance.findUnique({
          where: {
            personnelId_date_branchId: {
              personnelId,
              date: today,
              branchId,
            },
          },
          select: { status: true, checkIn: true, checkOut: true },
        }),
        prisma.personnelAttendance.findMany({
          where: {
            branchId,
            personnelId,
            date: { gte: chartRange.start, lte: chartRange.end },
          },
          select: { date: true, status: true, checkIn: true, checkOut: true },
        }),
        prisma.branchPayrollPolicy.findFirst({
          where: { branchId, isActive: true },
          select: { personnelDayMinutes: true },
        }),
      ]);
      const dayMinutes =
        policy?.personnelDayMinutes && policy.personnelDayMinutes > 0
          ? policy.personnelDayMinutes
          : DEFAULT_PERSONNEL_DAY_MINUTES;
      const dayHours = dayMinutes / 60;
      const month = emptyMonth();
      for (const record of records) bump(month, record.status);
      const series = emptyPresenceSeries(chartRange.keys);
      const byDate = new Map(series.map((item) => [item.date, item]));
      let todayHours = 0;
      for (const row of chartRows) {
        const hours = personnelWorkedHours(
          row,
          dayMinutes,
          now,
          chartRange.todayKey,
        );
        const key = calendarDateKey(row.date);
        const bucket = byDate.get(key);
        if (!bucket) continue;
        bucket.count = hours;
        if (key === chartRange.todayKey) todayHours = hours;
      }
      personnel = {
        id: personnelId,
        today: todayRow
          ? {
              status: todayRow.status,
              checkIn: todayRow.checkIn?.toISOString() ?? null,
              checkOut: todayRow.checkOut?.toISOString() ?? null,
            }
          : null,
        month,
        chart: {
          todayCount: todayHours,
          totalCount: dayHours,
          series,
        },
        dayHours,
      };
    }

    return { teacher, personnel };
  },
);

export const checkInMyPersonnelAction = action
  .input(geoSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId } = await requireBranchContext();
    const personnelId = await getPersonnelIdForUser(userId, branchId);
    if (!personnelId) {
      throw new Error("Profil personnel introuvable.");
    }

    await assertWithinBranchAttendanceRadius({
      branchId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
    });

    if (await isBranchClosedOn(branchId, undefined, "personnel")) {
      throw new Error(
        "Établissement fermé aujourd'hui (jour férié) — pas de pointage personnel.",
      );
    }

    const now = nowLocal();
    const today = startOfTodayParis(now);
    const existing = await prisma.personnelAttendance.findUnique({
      where: {
        personnelId_date_branchId: {
          personnelId,
          date: today,
          branchId,
        },
      },
    });

    if (existing?.checkIn) {
      throw new Error("Vous avez déjà pointé votre arrivée aujourd'hui.");
    }

    const status = await resolvePersonnelStatusFromSchedule(branchId, now);
    const attendance = await prisma.personnelAttendance.upsert({
      where: {
        personnelId_date_branchId: {
          personnelId,
          date: today,
          branchId,
        },
      },
      update: {
        status,
        checkIn: now,
      },
      create: {
        branchId,
        personnelId,
        date: today,
        status,
        checkIn: now,
      },
    });

    void afterPersonnelAttendanceWrite({
      branchId,
      organizationId,
      personnelId,
      attendanceId: attendance.id,
      date: today,
      status,
      checkIn: attendance.checkIn,
    }).catch((error) => {
      console.error("[checkInMyPersonnelAction] absence sync", error);
    });

    return { ok: true as const, status };
  });

export const checkOutMyPersonnelAction = action
  .input(geoSchema)
  .handler(async ({ input }) => {
    const { branchId, userId } = await requireBranchContext();
    const personnelId = await getPersonnelIdForUser(userId, branchId);
    if (!personnelId) {
      throw new Error("Profil personnel introuvable.");
    }

    await assertWithinBranchAttendanceRadius({
      branchId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
    });

    const now = nowLocal();
    const today = startOfTodayParis(now);
    const existing = await prisma.personnelAttendance.findUnique({
      where: {
        personnelId_date_branchId: {
          personnelId,
          date: today,
          branchId,
        },
      },
    });

    if (!existing?.checkIn) {
      throw new Error("Pointez d'abord votre arrivée.");
    }
    if (existing.checkOut) {
      throw new Error("Vous avez déjà pointé votre sortie aujourd'hui.");
    }

    await prisma.personnelAttendance.update({
      where: { id: existing.id },
      data: { checkOut: now },
    });

    return { ok: true as const };
  });
