import { prisma } from "@/lib/prisma";
import {
  getAcademicPeriodAliases,
  getAcademicStructure,
  normalizeBranchType,
} from "@/lib/academic-structure";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDefaultAcademicYearRange() {
  const today = new Date();
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;

  return {
    startDate: new Date(startYear, 8, 1),
    endDate: new Date(startYear + 1, 5, 30),
  };
}

export async function ensureAcademicPeriodsForBranch(params: {
  branchId: string;
  typebranch: unknown;
  startDate?: Date;
  endDate?: Date;
}) {
  const typebranch = normalizeBranchType(params.typebranch);
  const structure = getAcademicStructure(typebranch);
  const range = {
    ...getDefaultAcademicYearRange(),
    ...params,
  };

  const totalDays = Math.max(
    1,
    Math.ceil((range.endDate.getTime() - range.startDate.getTime()) / 86400000),
  );
  const groupLength = Math.max(1, Math.floor(totalDays / structure.groups.length));

  for (const group of structure.groups) {
    const groupStart = addDays(range.startDate, groupLength * (group.order - 1));
    const groupEnd =
      group.order === structure.groups.length
        ? range.endDate
        : addDays(range.startDate, groupLength * group.order - 1);

    const semester = await prisma.semester.upsert({
      where: {
        branchId_label: {
          branchId: params.branchId,
          label: group.label,
        },
      },
      update: {
        startDate: groupStart,
        endDate: groupEnd,
      },
      create: {
        label: group.label,
        startDate: groupStart,
        endDate: groupEnd,
        branchId: params.branchId,
      },
    });

    const periodLength = Math.max(
      1,
      Math.floor(
        Math.ceil((groupEnd.getTime() - groupStart.getTime()) / 86400000) /
          group.periods.length,
      ),
    );

    for (const period of group.periods) {
      const periodIndex = period.order - group.periods[0].order;
      const periodStart = addDays(groupStart, periodLength * periodIndex);
      const periodEnd =
        periodIndex === group.periods.length - 1
          ? groupEnd
          : addDays(groupStart, periodLength * (periodIndex + 1) - 1);

      const existing = await prisma.period.findFirst({
        where: {
          branchId: params.branchId,
          semesterId: semester.id,
          label: {
            in: [period.label, ...getAcademicPeriodAliases(period.label)],
          },
        },
      });

      if (existing) {
        await prisma.period.update({
          where: { id: existing.id },
          data: {
            label: period.label,
            startDate: periodStart,
            endDate: periodEnd,
          },
        });
        continue;
      }

      await prisma.period.create({
        data: {
          label: period.label,
          startDate: periodStart,
          endDate: periodEnd,
          semesterId: semester.id,
          branchId: params.branchId,
        },
      });
    }
  }
}
