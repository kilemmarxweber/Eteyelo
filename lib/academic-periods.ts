import { prisma } from "@/lib/prisma";
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import {
  getAcademicPeriodAliases,
  getAcademicPeriodOrderForSemester,
  getAcademicStructure,
  normalizeAcademicPeriodLabel,
  resolveAcademicPeriodConfig,
} from "@/lib/academic-structure";
import { UNIVERSITY_LMD_LABELS } from "@/lib/university-lmd-labels";
import { usesTermPeriodCalendar } from "@/lib/education-system";
import {
  cycleToManagedType,
  getBranchCycles,
  normalizeCycle,
  type Cycle,
} from "@/lib/cycle";

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

async function ensureAcademicPeriodsForCycle(params: {
  branchId: string;
  cycle: Cycle;
  educationSystem?: unknown;
  startDate: Date;
  endDate: Date;
}) {
  const typebranch = cycleToManagedType(params.cycle);
  const structure = getAcademicStructure(params.cycle, params.educationSystem);
  const range = { startDate: params.startDate, endDate: params.endDate };

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
        branchId_cycle_label: {
          branchId: params.branchId,
          cycle: params.cycle,
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
        cycle: params.cycle,
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
          cycle: params.cycle,
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
            cycle: params.cycle,
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
            cycle: params.cycle,
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
              cycle: params.cycle,
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
          cycle: params.cycle,
        },
      });
    }
  }
}

export async function ensureAcademicPeriodsForBranch(params: {
  branchId: string;
  typebranch: unknown;
  educationSystem?: unknown;
  cycles?: unknown[];
  startDate?: Date;
  endDate?: Date;
}) {
  const defaults = getDefaultAcademicYearRange();
  const startDate = params.startDate ?? defaults.startDate;
  const endDate = params.endDate ?? defaults.endDate;

  const cycles: Cycle[] = params.cycles?.length
    ? params.cycles.map((cycle) => normalizeCycle(cycle))
    : [normalizeCycle(params.typebranch)];

  for (const cycle of cycles) {
    await ensureAcademicPeriodsForCycle({
      branchId: params.branchId,
      cycle,
      educationSystem: params.educationSystem,
      startDate,
      endDate,
    });
  }
}

export type BranchPeriodOption = {
  id: number;
  label: string;
  rawLabel: string;
  semesterLabel: string | null;
  kind: "PERIOD" | "EXAM" | null;
  cycle?: Cycle | null;
};

function isKnownAcademicPeriod(
  label: string,
  typebranch: unknown,
  semesterLabel?: string | null,
  educationSystem?: unknown,
): boolean {
  return (
    resolveAcademicPeriodConfig(
      label,
      typebranch,
      semesterLabel,
      educationSystem,
    ) !== null
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

function periodDisplayKey(period: {
  rawLabel?: string | null;
  label: string;
  kind?: "PERIOD" | "EXAM" | null;
}) {
  return `${period.rawLabel ?? period.label}::${period.kind ?? ""}`;
}

/** Une entrée par libellé pédagogique, même si plusieurs cycles / classes existent. */
export function uniquePeriodOptions<
  T extends {
    rawLabel?: string | null;
    label: string;
    kind?: "PERIOD" | "EXAM" | null;
  },
>(periods: T[]): T[] {
  const seen = new Set<string>();
  return periods.filter((period) => {
    const key = periodDisplayKey(period);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Periodes / sessions de la branche, synchronisees sur le calendrier du type. */
export async function listBranchPeriodOptions(params: {
  branchId: string;
  typebranch: unknown;
  educationSystem?: unknown;
  cycle?: unknown;
  ensure?: boolean;
  /** Universite : ne retourner que Premiere session et Deuxieme session. */
  sessionsOnly?: boolean;
}): Promise<BranchPeriodOption[]> {
  const cycle = params.cycle
    ? normalizeCycle(params.cycle)
    : normalizeCycle(params.typebranch);
  const typebranch = cycleToManagedType(cycle);

  if (
    params.ensure !== false &&
    (isUniversiteBranch(typebranch) ||
      usesTermPeriodCalendar(cycle, params.educationSystem))
  ) {
    await ensureAcademicPeriodsForBranch({
      branchId: params.branchId,
      typebranch,
      educationSystem: params.educationSystem,
      cycles: [cycle],
    });
  }

  const periods = await prisma.period.findMany({
    where: {
      branchId: params.branchId,
      ...(params.cycle ? { cycle } : {}),
    },
    include: {
      semester: {
        select: { label: true, cycle: true },
      },
    },
  });

  const mapped = periods
    .map((period) => {
      const periodCycle = normalizeCycle(period.cycle ?? period.semester?.cycle ?? cycle);
      const rawLabel = normalizeAcademicPeriodLabel(period.label);
      const semesterLabel = period.semester?.label ?? null;
      const config = resolveAcademicPeriodConfig(
        rawLabel,
        periodCycle,
        semesterLabel,
        params.educationSystem,
      );
      const kind = config?.kind ?? null;
      const isUniversitySession =
        isUniversiteBranch(periodCycle) && kind === "EXAM";
      const label = isUniversitySession
        ? rawLabel
        : isUniversiteBranch(periodCycle) && semesterLabel
          ? `${rawLabel} · ${semesterLabel}`
          : rawLabel;

      return {
        id: period.id,
        label,
        rawLabel,
        semesterLabel,
        kind,
        cycle: periodCycle,
      };
    })
    .filter((period) =>
      isKnownAcademicPeriod(
        period.rawLabel,
        period.cycle,
        period.semesterLabel,
        params.educationSystem,
      ),
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
          left.cycle,
          left.semesterLabel,
          params.educationSystem,
        ) -
        getAcademicPeriodOrderForSemester(
          right.rawLabel,
          right.cycle,
          right.semesterLabel,
          params.educationSystem,
        ),
    );

  if (params.sessionsOnly && isUniversiteBranch(typebranch)) {
    return dedupeUniversitySessions(mapped);
  }

  return mapped;
}

export async function listActivatedBranchCycles(branchId: string, typebranch: unknown) {
  const rows = await prisma.branchCycle.findMany({
    where: { branchId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return getBranchCycles({ typebranch, cycles: rows });
}
