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
import { nowLocal, startOfTodayParis } from "@/lib/timezone";
import { checkTeacherAttendanceNeeded } from "./attendance/attendance.action";

const geoSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

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
};

export type DashboardPersonnelPresence = {
  id: string;
  today: {
    status: string;
    checkIn: string | null;
    checkOut: string | null;
  } | null;
  month: PresenceMonthSummary;
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

export const getMyDashboardPresenceAction = action.handler(
  async (): Promise<DashboardPresenceData> => {
    const { branchId, organizationId, userId } = await requireBranchContext();
    const { start, end } = monthRange();

    const [teacherId, personnelId] = await Promise.all([
      getTeacherIdForUser(userId, branchId),
      getPersonnelIdForUser(userId, branchId),
    ]);

    let teacher: DashboardTeacherPresence | null = null;
    if (teacherId) {
      const [records, pending] = await Promise.all([
        prisma.teacherAttendance.findMany({
          where: {
            branchId,
            teacherId,
            date: { gte: start, lte: end },
          },
          select: { status: true },
        }),
        checkTeacherAttendanceNeeded({ organizationId, branchId }),
      ]);
      const month = emptyMonth();
      for (const record of records) bump(month, record.status);
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
      };
    }

    let personnel: DashboardPersonnelPresence | null = null;
    if (personnelId) {
      const today = startOfTodayParis();
      const [records, todayRow] = await Promise.all([
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
      ]);
      const month = emptyMonth();
      for (const record of records) bump(month, record.status);
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
    });

    if (await isBranchClosedOn(branchId)) {
      throw new Error(
        "Établissement fermé aujourd'hui (jour férié) — pas de pointage.",
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
