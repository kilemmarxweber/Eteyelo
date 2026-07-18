import { prisma } from "@/lib/prisma";
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import {
  getAcademicPeriodAliases,
  getAcademicPeriodOrderForSemester,
  getAcademicStructure,
  normalizeAcademicPeriodLabel,
  normalizeBranchType,
  resolveAcademicPeriodConfig,
} from "@/lib/academic-structure";
import { UNIVERSITY_LMD_LABELS } from "@/lib/university-lmd-labels";

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

      if (
        isUniversiteBranch(typebranch) &&
        group.label === UNIVERSITY_LMD_LABELS.secondSemester &&
        period.label === UNIVERSITY_LMD_LABELS.secondSession
      ) {
        const staleFirstSession = await prisma.period.findFirst({
          where: {
            branchId: params.branchId,
            semesterId: semester.id,
            label: {
              in: [
                UNIVERSITY_LMD_LABELS.firstSession,
                ...getAcademicPeriodAliases(UNIVERSITY_LMD_LABELS.firstSession),
              ],
            },
          },
        });

        if (staleFirstSession) {
          await prisma.period.update({
            where: { id: staleFirstSession.id },
            data: {
              label: period.label,
              startDate: periodStart,
              endDate: periodEnd,
            },
          });
          continue;
        }
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

export type BranchPeriodOption = {
  id: number;
  label: string;
  rawLabel: string;
  semesterLabel: string | null;
  kind: "PERIOD" | "EXAM" | null;
};

function isKnownAcademicPeriod(
  label: string,
  typebranch: unknown,
  semesterLabel?: string | null,
): boolean {
  return (
    resolveAcademicPeriodConfig(label, typebranch, semesterLabel) !== null
  );
}

function dedupeUniversitySessions(
  periods: BranchPeriodOption[],
): BranchPeriodOption[] {
  const seen = new Set<string>();
  return periods.filter((period) => {
    if (seen.has(period.rawLabel)) return false;
    seen.add(period.rawLabel);
    return true;
  });
}

/** Periodes / sessions de la branche, synchronisees sur le calendrier du type. */
export async function listBranchPeriodOptions(params: {
  branchId: string;
  typebranch: unknown;
  ensure?: boolean;
  /** Universite : ne retourner que Premiere session et Deuxieme session. */
  sessionsOnly?: boolean;
}): Promise<BranchPeriodOption[]> {
  const typebranch = normalizeBranchType(params.typebranch);

  if (params.ensure !== false && isUniversiteBranch(typebranch)) {
    await ensureAcademicPeriodsForBranch({
      branchId: params.branchId,
      typebranch,
    });
  }

  const periods = await prisma.period.findMany({
    where: { branchId: params.branchId },
    include: {
      semester: {
        select: { label: true },
      },
    },
  });

  const mapped = periods
    .map((period) => {
      const rawLabel = normalizeAcademicPeriodLabel(period.label);
      const semesterLabel = period.semester?.label ?? null;
      const config = resolveAcademicPeriodConfig(
        rawLabel,
        typebranch,
        semesterLabel,
      );
      const kind = config?.kind ?? null;
      const isUniversitySession =
        isUniversiteBranch(typebranch) && kind === "EXAM";
      const label = isUniversitySession
        ? rawLabel
        : isUniversiteBranch(typebranch) && semesterLabel
          ? `${rawLabel} · ${semesterLabel}`
          : rawLabel;

      return {
        id: period.id,
        label,
        rawLabel,
        semesterLabel,
        kind,
      };
    })
    .filter((period) =>
      isKnownAcademicPeriod(period.rawLabel, typebranch, period.semesterLabel),
    )
    .filter((period) => {
      if (!params.sessionsOnly || !isUniversiteBranch(typebranch)) {
        return true;
      }
      return period.kind === "EXAM";
    })
    .sort(
      (left, right) =>
        getAcademicPeriodOrderForSemester(
          left.rawLabel,
          typebranch,
          left.semesterLabel,
        ) -
        getAcademicPeriodOrderForSemester(
          right.rawLabel,
          typebranch,
          right.semesterLabel,
        ),
    );

  if (params.sessionsOnly && isUniversiteBranch(typebranch)) {
    return dedupeUniversitySessions(mapped);
  }

  return mapped;
}
