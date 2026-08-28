"use server";

import { auth } from "@/lib/auth";
import {
  calculateBulletinPercentage,
  sumBulletinMaxima,
} from "@/lib/bulletin-maxima";
import { countBranchStudents } from "@/lib/branch-student-count";
import {
  getDashboardDataBlocks,
  resolveDashboardVariant,
  type DashboardVariant,
} from "@/lib/auth/dashboard-variant";
import { getBaseCurrency } from "@/lib/exchange-rate";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/auth/get-session-cached";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessFinanceArea, isOrganizationOwnerSession, resolveCashierSelfScope } from "@/lib/auth/session-roles";
import { switchActiveBranch } from "@/lib/auth/switch-branch";
import { action } from "@/lib/zsa";
import { Day } from "@/prisma/generated/prisma/client";
import { headers } from "next/headers";
import { z } from "zod";
import {
  computeScopedDiscountAmount,
  EMPTY_DISCOUNT,
  getBestDiscountInfo,
  type DiscountInfo,
} from "@/lib/payment-discount";
import { buildStudentAnnouncementsData } from "@/lib/student-announcements";
import { getBranchCycles, buildDashboardCycleStats } from "@/lib/cycle";

const BRANCH_CYCLE_SELECT = {
  where: { isActive: true },
  orderBy: { sortOrder: "asc" as const },
  select: { cycle: true, isActive: true, sortOrder: true },
};

const EMPTY_METRICS = {
  attendance: 0,
  attendanceCount: 0,
  successRate: 0,
  averageScore: 0,
  studentsCount: 0,
  passedCount: 0,
  satisfaction: 0,
  feedbackCount: 0,
  parentsCount: 0,
  responseRate: 0,
};

const JS_DAY_TO_PRISMA: Day[] = [
  Day.Dimanche,
  Day.Lundi,
  Day.Mardi,
  Day.Mercredi,
  Day.Jeudi,
  Day.Vendredi,
  Day.Samedi,
];

function formatPersonName(user: {
  prenom?: string | null;
  name?: string | null;
  postnom?: string | null;
} | null | undefined) {
  if (!user) return "";
  return [user.prenom, user.name, user.postnom]
    .filter(Boolean)
    .join(" ")
    .trim();
}

const SUCCESS_THRESHOLD_PERCENT = 50;

type FicheNoteRow = {
  studentId?: string;
  score?: number | null;
  maxScore?: number | null;
};

function parseFicheNotes(raw: unknown): FicheNoteRow[] {
  try {
    const notes =
      typeof raw === "string"
        ? JSON.parse(raw)
        : Array.isArray(raw)
          ? raw
          : [];
    return Array.isArray(notes) ? notes : [];
  } catch {
    return [];
  }
}

/** Moyennes élèves = points / somme des maxima de période de tous les cours. */
async function getBranchStudentAverages(params: {
  branchId: string;
  yearId?: string;
}): Promise<number[]> {
  const fiches = await prisma.fiche.findMany({
    where: {
      branchId: params.branchId,
      typeFiche: "ficheCote",
      ...(params.yearId ? { anneeId: params.yearId } : {}),
    },
    select: {
      notes: true,
      periodeName: true,
    },
  });

  const byStudent = new Map<string, { score: number; maxScores: number[] }>();

  for (const fiche of fiches) {
    const notes = parseFicheNotes(fiche.notes);
    if (notes.length === 0) continue;

    const coursePeriodMax = Math.max(
      0,
      ...notes.map((note) => {
        const max = Number(note.maxScore ?? 0);
        return Number.isFinite(max) && max > 0 ? max : 0;
      }),
    );
    if (!(coursePeriodMax > 0)) continue;

    for (const note of notes) {
      if (!note?.studentId) continue;
      const score = Number(note.score ?? 0);
      const noteMax = Number(note.maxScore ?? 0);
      const maxForStudent =
        Number.isFinite(noteMax) && noteMax > 0 ? noteMax : coursePeriodMax;

      const current = byStudent.get(note.studentId) ?? {
        score: 0,
        maxScores: [],
      };
      current.score += Number.isFinite(score) ? score : 0;
      current.maxScores.push(maxForStudent);
      byStudent.set(note.studentId, current);
    }
  }

  const averages: number[] = [];
  for (const totals of byStudent.values()) {
    const totalMax = sumBulletinMaxima(totals.maxScores);
    if (!(totalMax > 0)) continue;
    averages.push(calculateBulletinPercentage(totals.score, totalMax));
  }
  return averages;
}
// 📅 Helpers
function getMonthRange(date: Date) {
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
  const end = new Date(
    Date.UTC(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
  );
  return { start, end };
}

export async function getSessionUser() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) return null;

  return session.user;
}

function calcPercentage(current: number, previous: number) {
  if (previous > 0) {
    return Number((((current - previous) / previous) * 100).toFixed(0));
  } else if (current > 0) {
    return 100;
  }
  return 0;
}

function calcRate(part: number, total: number) {
  return total > 0 ? Number(((part / total) * 100).toFixed(0)) : 0;
}
const adminStatsSchema = z.object({
  branchId: z.string(),
  organizationId: z.string(),
});

export async function getAdminStats({
  branchId,
  organizationId,
}: z.infer<typeof adminStatsSchema>) {
  try {
    const { session, branchId: activeBranchId } = await requireBranchContext();
    const blocks = getDashboardDataBlocks(resolveDashboardVariant(session));

    if (!blocks.schoolStats || activeBranchId !== branchId) {
      return { error: "UNAUTHORIZED" as const };
    }

    // Chef école (préfet/directeur) : stats sans revenus ; gestionnaire conserve la finance.
    const includeRevenue = blocks.revenue && canAccessFinanceArea(session);
    const now = new Date();

    const { end: endCurrent } = getMonthRange(now);
    const { end: endPrev } = getMonthRange(
      new Date(now.getFullYear(), now.getMonth() - 1),
    );

    // =========================
    // BRANCH
    // =========================
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId,
      },
      select: {
        id: true,
        typebranch: true,
        educationSystem: true,
        cycles: BRANCH_CYCLE_SELECT,
      },
    });

    if (!branch) {
      return {
        error: "Branch not found",
      };
    }
    // =========================
    // SCHOOL YEAR
    // =========================
    const currentYear = await prisma.schoolYear.findFirst({
      where: {
        isCurrentYear: true,
        branchId: branch.id,
      },
    });

    if (!currentYear) {
      const selectedExchangeRate = await prisma.exchangeRate.findFirst({
        where: { organizationId, isSelected: true },
        select: {
          fromCurrency: true,
          toCurrency: true,
          isActive: true,
          isSelected: true,
        },
      });
      const exchangeRates = await prisma.exchangeRate.findMany({
        where: { organizationId, isActive: true },
        select: {
          fromCurrency: true,
          toCurrency: true,
          rate: true,
          isActive: true,
          isSelected: true,
        },
      });
      const activatedCycles = getBranchCycles(branch);
      const classRows =
        activatedCycles.length > 1
          ? await prisma.classe.findMany({
              where: { branchId: branch.id },
              select: { cycle: true },
            })
          : [];

      return {
        typebranch: branch.typebranch,
        cycles: activatedCycles,
        byCycle: buildDashboardCycleStats({
          cycles: activatedCycles,
          typebranch: branch.typebranch,
          classes: classRows,
          enrollments: [],
          teachings: [],
        }),
        baseCurrency:
          selectedExchangeRate?.fromCurrency ?? getBaseCurrency(exchangeRates),
        quoteCurrency: selectedExchangeRate?.toCurrency ?? null,
        selectedRatePair: selectedExchangeRate
          ? `${selectedExchangeRate.fromCurrency}→${selectedExchangeRate.toCurrency}`
          : null,
        error: "NO_CURRENT_SCHOOL_YEAR",
      };
    }

    // =========================
    // COUNTS + GROUPBYS + DEVISE (parallèle)
    // =========================
    const [
      uniqueStudentsCurrent,
      uniqueStudentsPrev,
      uniqueClassesCurrent,
      uniqueClassesPrev,
      uniqueTeachersCurrent,
      uniqueTeachersPrev,
      totalStudentsCurrent,
      totalStudentsPrev,
      classesTotal,
      teachersTotal,
      coursesTotal,
      revenueCurrentAgg,
      revenuePrevAgg,
      selectedExchangeRate,
      exchangeRates,
    ] = await Promise.all([
      prisma.classEnrollment.groupBy({
        by: ["studentId"],
        where: {
          schoolYearId: currentYear.id,
          branchId: branch.id,
          statusEnrollment: true,
          createdAt: { lte: endCurrent },
        },
      }),
      prisma.classEnrollment.groupBy({
        by: ["studentId"],
        where: {
          schoolYearId: currentYear.id,
          branchId: branch.id,
          statusEnrollment: true,
          createdAt: { lte: endPrev },
        },
      }),
      prisma.classEnrollment.groupBy({
        by: ["classeId"],
        where: {
          schoolYearId: currentYear.id,
          branchId: branch.id,
          statusEnrollment: true,
          createdAt: { lte: endCurrent },
        },
      }),
      prisma.classEnrollment.groupBy({
        by: ["classeId"],
        where: {
          schoolYearId: currentYear.id,
          branchId: branch.id,
          statusEnrollment: true,
          createdAt: { lte: endPrev },
        },
      }),
      prisma.teaching.groupBy({
        by: ["teacherId"],
        where: {
          schoolYearId: currentYear.id,
          branchId: branch.id,
          statusTeaching: true,
          createdAt: { lte: endCurrent },
        },
      }),
      prisma.teaching.groupBy({
        by: ["teacherId"],
        where: {
          schoolYearId: currentYear.id,
          branchId: branch.id,
          statusTeaching: true,
          createdAt: { lte: endPrev },
        },
      }),
      countBranchStudents({
        branchId: branch.id,
        createdBefore: endCurrent,
      }),
      countBranchStudents({
        branchId: branch.id,
        createdBefore: endPrev,
      }),
      prisma.classe.count({
        where: { branchId: branch.id },
      }),
      prisma.teacher.count({
        where: {
          branchMember: { branchId: branch.id },
        },
      }),
      prisma.cours.count({
        where: { branchId: branch.id },
      }),
      includeRevenue
        ? prisma.familyPayment.aggregate({
            _sum: { amount: true },
            where: {
              branchId: branch.id,
              status: "VALIDE",
              createdAt: { lte: endCurrent },
            },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      includeRevenue
        ? prisma.familyPayment.aggregate({
            _sum: { amount: true },
            where: {
              branchId: branch.id,
              status: "VALIDE",
              createdAt: { lte: endPrev },
            },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      prisma.exchangeRate.findFirst({
        where: { organizationId, isSelected: true },
        select: {
          fromCurrency: true,
          toCurrency: true,
          isActive: true,
          isSelected: true,
        },
      }),
      prisma.exchangeRate.findMany({
        where: { organizationId, isActive: true },
        select: {
          fromCurrency: true,
          toCurrency: true,
          rate: true,
          isActive: true,
          isSelected: true,
        },
      }),
    ]);

    const activatedCycles = getBranchCycles(branch);
    const [classCycleRows, enrollmentCycleRows, teachingCycleRows, paymentCycleRows] =
      activatedCycles.length > 1
        ? await Promise.all([
            prisma.classe.findMany({
              where: { branchId: branch.id },
              select: { cycle: true },
            }),
            prisma.classEnrollment.findMany({
              where: {
                schoolYearId: currentYear.id,
                branchId: branch.id,
                statusEnrollment: true,
                createdAt: { lte: endCurrent },
              },
              select: {
                studentId: true,
                classe: { select: { cycle: true } },
              },
            }),
            prisma.teaching.findMany({
              where: {
                schoolYearId: currentYear.id,
                branchId: branch.id,
              },
              select: {
                teacherId: true,
                classe: { select: { cycle: true } },
              },
            }),
            includeRevenue
              ? prisma.familyPayment.findMany({
                  where: {
                    branchId: branch.id,
                    status: "VALIDE",
                    createdAt: { lte: endCurrent },
                  },
                  select: {
                    amount: true,
                    classEnrollment: {
                      select: { classe: { select: { cycle: true } } },
                    },
                    frais: {
                      select: { classe: { select: { cycle: true } } },
                    },
                  },
                })
              : Promise.resolve([]),
          ])
        : [[], [], [], []];

    const byCycle = buildDashboardCycleStats({
      cycles: activatedCycles,
      typebranch: branch.typebranch,
      classes: classCycleRows,
      enrollments: enrollmentCycleRows,
      teachings: teachingCycleRows,
      payments: paymentCycleRows.map((payment) => ({
        amount: Number(payment.amount),
        cycle:
          payment.classEnrollment?.classe?.cycle ??
          payment.frais?.classe?.cycle,
      })),
    });

    // =========================
    // DERIVED VALUES
    // =========================
    const enrolledCurrent = uniqueStudentsCurrent.length;
    const enrolledPrev = uniqueStudentsPrev.length;

    const activeClassesCurrent = uniqueClassesCurrent.length;
    const activeClassesPrev = uniqueClassesPrev.length;

    const activeTeachersCurrent = uniqueTeachersCurrent.length;
    const activeTeachersPrev = uniqueTeachersPrev.length;

    const notEnrolledCurrent = totalStudentsCurrent - enrolledCurrent;
    const notEnrolledPrev = totalStudentsPrev - enrolledPrev;

    const inactiveClassesCurrent = classesTotal - activeClassesCurrent;
    const inactiveTeachersCurrent = teachersTotal - activeTeachersCurrent;

    // =========================
    // RATES + CHANGES
    // =========================
    const enrollmentRateCurrent = calcRate(
      enrolledCurrent,
      totalStudentsCurrent,
    );
    const enrollmentRatePrev = calcRate(enrolledPrev, totalStudentsPrev);

    const classOccupancyRate = calcRate(activeClassesCurrent, classesTotal);
    const classOccupancyRatePrev = calcRate(activeClassesPrev, classesTotal);

    const teacherActivityRate = calcRate(activeTeachersCurrent, teachersTotal);
    const teacherActivityRatePrev = calcRate(activeTeachersPrev, teachersTotal);

    // =========================
    // REVENUE + DEVISE DE BASE (taux sélectionné : fromCurrency)
    // Ex. AOA → USD sélectionné ⇒ base = AOA
    // =========================
    const revenueCurrent = includeRevenue
      ? (revenueCurrentAgg._sum.amount ?? 0)
      : 0;
    const revenuePrev = includeRevenue
      ? (revenuePrevAgg._sum.amount ?? 0)
      : 0;

    const baseCurrency =
      selectedExchangeRate?.fromCurrency ?? getBaseCurrency(exchangeRates);
    const quoteCurrency =
      selectedExchangeRate?.toCurrency ??
      exchangeRates.find((r) => r.isSelected)?.toCurrency ??
      null;

    // =========================
    // RETURN
    // =========================
    return {
      typebranch: branch.typebranch,
      cycles: activatedCycles,
      byCycle,
      baseCurrency,
      quoteCurrency,
      selectedRatePair: selectedExchangeRate
        ? `${selectedExchangeRate.fromCurrency}→${selectedExchangeRate.toCurrency}`
        : null,
      students: {
        total: totalStudentsCurrent,
        enrolled: enrolledCurrent,
        notEnrolled: notEnrolledCurrent,
        enrollmentRate: enrollmentRateCurrent,
        notEnrolledRate: calcRate(notEnrolledCurrent, totalStudentsCurrent),

        previous: {
          total: totalStudentsPrev,
          enrolled: enrolledPrev,
          notEnrolled: notEnrolledPrev,
          enrollmentRate: enrollmentRatePrev,
        },

        change: {
          diff: enrolledCurrent - enrolledPrev,
          percentage: calcPercentage(enrolledCurrent, enrolledPrev),
        },
      },

      classes: {
        total: classesTotal,
        active: activeClassesCurrent,
        inactive: inactiveClassesCurrent,
        occupancyRate: classOccupancyRate,

        previous: {
          active: activeClassesPrev,
          occupancyRate: classOccupancyRatePrev,
        },

        change: {
          diff: activeClassesCurrent - activeClassesPrev,
          percentage: calcPercentage(activeClassesCurrent, activeClassesPrev),
        },
      },

      teachers: {
        total: teachersTotal,
        active: activeTeachersCurrent,
        inactive: inactiveTeachersCurrent,
        activityRate: teacherActivityRate,

        previous: {
          active: activeTeachersPrev,
          activityRate: teacherActivityRatePrev,
        },

        change: {
          diff: activeTeachersCurrent - activeTeachersPrev,
          percentage: calcPercentage(activeTeachersCurrent, activeTeachersPrev),
        },
      },

      courses: coursesTotal,

      revenue: includeRevenue
        ? {
            current: revenueCurrent,
            previous: revenuePrev,
            percentageChange: calcPercentage(revenueCurrent, revenuePrev),
            currency: baseCurrency,
          }
        : null,

      attendance: 0,
    };
  } catch (error) {
    console.error("getAdminStats error:", error);

    return {
      typebranch: null,
      cycles: [] as const,
      byCycle: [] as const,
      baseCurrency: "USD",
      quoteCurrency: null,
      selectedRatePair: null,
      students: {
        total: 0,
        enrolled: 0,
        notEnrolled: 0,
        enrollmentRate: 0,
        notEnrolledRate: 0,
        previous: {
          total: 0,
          enrolled: 0,
          notEnrolled: 0,
          enrollmentRate: 0,
        },
        change: { diff: 0, percentage: 0 },
      },

      classes: {
        total: 0,
        active: 0,
        inactive: 0,
        occupancyRate: 0,
        previous: { active: 0, occupancyRate: 0 },
        change: { diff: 0, percentage: 0 },
      },

      teachers: {
        total: 0,
        active: 0,
        inactive: 0,
        activityRate: 0,
        previous: { active: 0, activityRate: 0 },
        change: { diff: 0, percentage: 0 },
      },

      courses: 0,

      revenue: {
        current: 0,
        previous: 0,
        percentageChange: 0,
        currency: "USD",
      },

      attendance: 0,
    };
  }
}

export const getDashboardMetrics = action.handler(async () => {
  const { branchId, session } = await requireBranchContext();
  const blocks = getDashboardDataBlocks(resolveDashboardVariant(session));

  if (!blocks.pedagogyMetrics) {
    throw new Error("Action non autorisée");
  }

  const currentYear = await prisma.schoolYear.findFirst({
    where: { isCurrentYear: true, branchId },
    select: { id: true },
  });

  const currentMonth = new Date().getMonth() + 1;

  const [attendanceResult, averagesResult, feedbackResult] =
    await Promise.allSettled([
      (async () => {
        const [totalAttendance, presentOrLate] = await Promise.all([
          prisma.studentAttendance.count({ where: { branchId } }),
          prisma.studentAttendance.count({
            where: {
              branchId,
              status: { in: ["PRESENT", "LATE"] },
            },
          }),
        ]);
        return {
          attendanceCount: totalAttendance,
          attendance:
            totalAttendance > 0
              ? Math.round((presentOrLate / totalAttendance) * 100)
              : 0,
        };
      })(),
      (async () => {
        let averages = await getBranchStudentAverages({
          branchId,
          yearId: currentYear?.id,
        });
        if (averages.length === 0 && currentYear?.id) {
          averages = await getBranchStudentAverages({ branchId });
        }
        const studentsCount = averages.length;
        const passedCount = averages.filter(
          (avg) => avg >= SUCCESS_THRESHOLD_PERCENT,
        ).length;
        return {
          studentsCount,
          passedCount,
          averageScore:
            studentsCount > 0
              ? Math.round(
                  (averages.reduce((sum, avg) => sum + avg, 0) / studentsCount) *
                    10,
                ) / 10
              : 0,
          successRate:
            studentsCount > 0
              ? Math.round((passedCount / studentsCount) * 100)
              : 0,
        };
      })(),
      (async () => {
        const [totalParents, yearFeedbacks, monthFeedbacks] = await Promise.all([
          prisma.parent.count({
            where: { branchMember: { branchId } },
          }),
          prisma.parentFeedback.findMany({
            where: {
              branchId,
              ...(currentYear?.id ? { schoolYearId: currentYear.id } : {}),
            },
            select: { rating: true },
          }),
          prisma.parentFeedback.count({
            where: {
              branchId,
              month: currentMonth,
              ...(currentYear?.id ? { schoolYearId: currentYear.id } : {}),
            },
          }),
        ]);
        const feedbackCount = yearFeedbacks.length;
        const satisfiedCount = yearFeedbacks.filter((f) => f.rating >= 4).length;
        return {
          parentsCount: totalParents,
          feedbackCount,
          satisfaction:
            feedbackCount > 0
              ? Math.round((satisfiedCount / feedbackCount) * 100)
              : 0,
          responseRate:
            totalParents > 0
              ? Math.round((monthFeedbacks / totalParents) * 100)
              : 0,
        };
      })(),
    ]);

  return {
    ...EMPTY_METRICS,
    ...(attendanceResult.status === "fulfilled" ? attendanceResult.value : {}),
    ...(averagesResult.status === "fulfilled" ? averagesResult.value : {}),
    ...(feedbackResult.status === "fulfilled" ? feedbackResult.value : {}),
  };
});

async function getBranchEvents(branchId: string) {
  const now = Date.now();
  return prisma.calendarEvent.findMany({
    where: {
      branchId,
      isArchived: false,
      dateStart: { gte: new Date(now - 1000 * 60 * 60 * 24) },
    },
    select: {
      id: true,
      title: true,
      dateStart: true,
    },
    orderBy: { dateStart: "asc" },
    take: 8,
  });
}

/**
 * Nombre d'inscriptions avec solde > 0 (frais − paiements − remise).
 * Aligné sur le rapport impayés — pas la table Invoice (souvent vide).
 */
async function countUnpaidEnrollments(
  branchId: string,
  schoolYearId: string,
): Promise<number> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      branchId,
      schoolYearId,
      OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
    },
    select: {
      id: true,
      classeId: true,
      student: { select: { parentId: true } },
    },
  });

  if (enrollments.length === 0) return 0;

  const classeIds = Array.from(
    new Set(enrollments.map((e) => e.classeId).filter(Boolean)),
  );

  const fraisList = await prisma.frais.findMany({
    where: {
      branchId,
      statusFrais: true,
      classeId: { in: classeIds },
      OR: [{ schoolYearId }, { schoolYearId: null }],
    },
    select: {
      id: true,
      classeId: true,
      montantFrais: true,
      typeFraisId: true,
    },
  });

  const fraisByClasse = new Map<
    string,
    Array<{ id: string; montant: number; typeFraisId: string | null }>
  >();
  const fraisIds: string[] = [];
  for (const frais of fraisList) {
    fraisIds.push(frais.id);
    const list = fraisByClasse.get(frais.classeId) ?? [];
    list.push({
      id: frais.id,
      montant: Number(frais.montantFrais),
      typeFraisId: frais.typeFraisId,
    });
    fraisByClasse.set(frais.classeId, list);
  }

  if (fraisIds.length === 0) return 0;

  const enrollmentIds = enrollments.map((e) => e.id);
  const paidByEnrollment = new Map<string, number>();
  const aggregates = await prisma.familyPayment.groupBy({
    by: ["classEnrollmentId"],
    where: {
      branchId,
      classEnrollmentId: { in: enrollmentIds },
      fraisId: { in: fraisIds },
      status: "VALIDE",
    },
    _sum: { amount: true },
  });
  for (const row of aggregates) {
    paidByEnrollment.set(
      row.classEnrollmentId,
      Number(row._sum.amount ?? 0),
    );
  }

  const parentIds = Array.from(
    new Set(
      enrollments
        .map((e) => e.student?.parentId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const discountByParentId = new Map<string, DiscountInfo>();
  await Promise.all(
    parentIds.map(async (parentId) => {
      discountByParentId.set(
        parentId,
        await getBestDiscountInfo(prisma, parentId, branchId),
      );
    }),
  );

  let unpaidCount = 0;
  for (const enrollment of enrollments) {
    const classeFrais = fraisByClasse.get(enrollment.classeId) ?? [];
    if (classeFrais.length === 0) continue;

    const montantDuBrut = classeFrais.reduce((sum, f) => sum + f.montant, 0);
    const parentId = enrollment.student?.parentId ?? null;
    const discount = parentId
      ? (discountByParentId.get(parentId) ?? EMPTY_DISCOUNT)
      : EMPTY_DISCOUNT;
    const remise = computeScopedDiscountAmount(
      classeFrais.map((f) => ({
        base: f.montant,
        typeFraisId: f.typeFraisId,
      })),
      discount,
    );
    const montantDu = Math.max(0, montantDuBrut - remise);
    const montantPaye = paidByEnrollment.get(enrollment.id) ?? 0;
    if (montantDu > 0 && montantPaye < montantDu) {
      unpaidCount += 1;
    }
  }

  return unpaidCount;
}

async function getCashierDashboardData(
  branchId: string,
  organizationId: string,
  userId: string,
  session: any,
) {
  if (!canAccessFinanceArea(session)) {
    throw new Error("Action non autorisée");
  }

  const cashierScope = resolveCashierSelfScope(session, userId);
  const cashierFilter = cashierScope
    ? { createdByUserId: cashierScope }
    : {};

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const currentYear = await prisma.schoolYear.findFirst({
    where: { isCurrentYear: true, branchId },
    select: { id: true },
  });

  const [
    todayAgg,
    todayCount,
    todayExpenseAgg,
    openingIncomeAgg,
    openingExpenseAgg,
    unpaidCount,
    selectedExchangeRate,
    exchangeRates,
  ] = await Promise.all([
    prisma.familyPayment.aggregate({
      _sum: { amount: true },
      where: {
        branchId,
        status: "VALIDE",
        createdAt: { gte: start, lt: end },
        ...cashierFilter,
      },
    }),
    prisma.familyPayment.count({
      where: {
        branchId,
        status: "VALIDE",
        createdAt: { gte: start, lt: end },
        ...cashierFilter,
      },
    }),
    prisma.cashierExpense.aggregate({
      _sum: { amount: true },
      where: {
        branchId,
        createdAt: { gte: start, lt: end },
        ...cashierFilter,
      },
    }),
    prisma.familyPayment.aggregate({
      _sum: { amount: true },
      where: {
        branchId,
        status: "VALIDE",
        createdAt: { lt: start },
        ...cashierFilter,
      },
    }),
    prisma.cashierExpense.aggregate({
      _sum: { amount: true },
      where: {
        branchId,
        createdAt: { lt: start },
        ...cashierFilter,
      },
    }),
    currentYear
      ? countUnpaidEnrollments(branchId, currentYear.id)
      : Promise.resolve(0),
    prisma.exchangeRate.findFirst({
      where: { organizationId, isSelected: true },
      select: { fromCurrency: true },
    }),
    prisma.exchangeRate.findMany({
      where: { organizationId, isActive: true },
      select: {
        fromCurrency: true,
        toCurrency: true,
        rate: true,
        isActive: true,
        isSelected: true,
      },
    }),
  ]);

  const todayIncome = todayAgg._sum.amount ?? 0;
  const todayExpenses = todayExpenseAgg._sum.amount ?? 0;
  const openingBalance =
    Number(openingIncomeAgg._sum.amount ?? 0) -
    Number(openingExpenseAgg._sum.amount ?? 0);

  return {
    todayIncome,
    todayCount,
    todayExpenses,
    openingBalance,
    netBalance: openingBalance + todayIncome - todayExpenses,
    unpaidInvoices: unpaidCount,
    scopedToSelf: Boolean(cashierScope),
    currency:
      selectedExchangeRate?.fromCurrency ?? getBaseCurrency(exchangeRates),
  };
}

async function getTeacherDashboardData(branchId: string, userId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: {
      branchMember: {
        branchId,
        member: { userId },
      },
    },
    select: { id: true },
  });

  if (!teacher) {
    return {
      teacherId: null as string | null,
      classes: [] as { id: string; name: string }[],
      todayCourses: [] as {
        id: string;
        courseName: string;
        className: string;
        hour: string;
      }[],
      assignmentCount: 0,
    };
  }

  const today = JS_DAY_TO_PRISMA[new Date().getDay()]!;

  const [teachings, todaySchedules] = await Promise.all([
    prisma.teaching.findMany({
      where: {
        teacherId: teacher.id,
        schoolYear: { isCurrentYear: true, branchId, isArchived: false },
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
      },
      select: {
        id: true,
        classe: { select: { id: true, nameClasse: true } },
        cours: { select: { id: true, nameCours: true } },
      },
    }),
    prisma.schedule.findMany({
      where: {
        day: today,
        isArchived: false,
        teaching: {
          teacherId: teacher.id,
          schoolYear: { isCurrentYear: true, branchId, isArchived: false },
        },
      },
      select: {
        id: true,
        hour: true,
        teaching: {
          select: {
            cours: { select: { nameCours: true } },
            classe: { select: { nameClasse: true } },
          },
        },
      },
      orderBy: { hour: "asc" },
    }),
  ]);

  const classMap = new Map<string, string>();
  for (const teaching of teachings) {
    if (teaching.classe?.id) {
      classMap.set(teaching.classe.id, teaching.classe.nameClasse);
    }
  }

  return {
    teacherId: teacher.id,
    classes: Array.from(classMap.entries()).map(([id, name]) => ({ id, name })),
    todayCourses: todaySchedules.map((slot) => ({
      id: slot.id,
      courseName: slot.teaching?.cours?.nameCours ?? "Cours",
      className: slot.teaching?.classe?.nameClasse ?? "—",
      hour: slot.hour
        ? new Date(slot.hour).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
    })),
    assignmentCount: teachings.length,
  };
}

async function getStudentDashboardData(branchId: string, userId: string) {
  const student = await prisma.student.findFirst({
    where: {
      branchMember: {
        branchId,
        member: { userId },
      },
    },
    select: {
      id: true,
      branchMember: {
        select: {
          member: {
            select: {
              user: {
                select: { prenom: true, name: true, postnom: true },
              },
            },
          },
        },
      },
      classEnrollment: {
        where: {
          branchId,
          statusEnrollment: true,
          schoolYear: { isCurrentYear: true, branchId },
        },
        take: 1,
        select: {
          classe: { select: { nameClasse: true } },
          schoolYear: { select: { nameYear: true } },
        },
      },
    },
  });

  if (!student) return null;

  const enrollment = student.classEnrollment[0];
  return {
    studentId: student.id,
    name: formatPersonName(student.branchMember?.member?.user),
    className: enrollment?.classe?.nameClasse ?? null,
    schoolYear: enrollment?.schoolYear?.nameYear ?? null,
  };
}

async function getParentAnnualSatisfaction(
  branchId: string,
  userId: string,
) {
  const [currentYear, parent] = await Promise.all([
    prisma.schoolYear.findFirst({
      where: { isCurrentYear: true, branchId },
      select: { id: true, nameYear: true },
    }),
    prisma.parent.findFirst({
      where: {
        branchMember: {
          branchId,
          member: { userId },
        },
      },
      select: { id: true },
    }),
  ]);

  if (!currentYear) {
    return {
      percentage: 0,
      feedbackCount: 0,
      schoolYearLabel: null as string | null,
      myAverageRating: null as number | null,
      myFeedbackCount: 0,
    };
  }

  const yearFeedbacks = await prisma.parentFeedback.findMany({
    where: {
      branchId,
      schoolYearId: currentYear.id,
    },
    select: { rating: true, parentId: true },
  });

  const feedbackCount = yearFeedbacks.length;
  const satisfiedCount = yearFeedbacks.filter((f) => f.rating >= 4).length;
  const mine = parent
    ? yearFeedbacks.filter((f) => f.parentId === parent.id)
    : [];
  const myFeedbackCount = mine.length;
  const myAverageRating =
    myFeedbackCount > 0
      ? Math.round(
          (mine.reduce((sum, f) => sum + f.rating, 0) / myFeedbackCount) * 10,
        ) / 10
      : null;

  return {
    percentage:
      feedbackCount > 0
        ? Math.round((satisfiedCount / feedbackCount) * 100)
        : 0,
    feedbackCount,
    schoolYearLabel: currentYear.nameYear,
    myAverageRating,
    myFeedbackCount,
  };
}

async function getParentDashboardData(
  branchId: string,
  userId: string,
  organizationId: string,
) {
  const children = await prisma.student.findMany({
    where: {
      branchMember: { branchId },
      parent: {
        branchMember: {
          branchId,
          member: { userId },
        },
      },
    },
    select: {
      id: true,
      parentId: true,
      branchMember: {
        select: {
          member: {
            select: {
              user: {
                select: { prenom: true, name: true, postnom: true },
              },
            },
          },
        },
      },
      classEnrollment: {
        where: {
          branchId,
          statusEnrollment: true,
          schoolYear: { isCurrentYear: true, branchId },
        },
        take: 1,
        select: {
          id: true,
          classeId: true,
          classe: { select: { nameClasse: true } },
        },
      },
    },
  });

  const mappedChildren = children.map((child) => ({
    id: child.id,
    name: formatPersonName(child.branchMember?.member?.user),
    className: child.classEnrollment[0]?.classe?.nameClasse ?? null,
  }));

  const enrollments = children
    .map((child) => {
      const enrollment = child.classEnrollment[0];
      if (!enrollment) return null;
      return {
        id: enrollment.id,
        classeId: enrollment.classeId,
        parentId: child.parentId,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const parentId = enrollments[0]?.parentId ?? children[0]?.parentId ?? null;

  const emptyFinance = {
    totalDue: 0,
    totalPaid: 0,
    totalRemaining: 0,
    currency: "USD",
  };

  const classeIds = Array.from(
    new Set(enrollments.map((e) => e.classeId).filter(Boolean)),
  );

  const [satisfaction, currentYear] = await Promise.all([
    getParentAnnualSatisfaction(branchId, userId),
    prisma.schoolYear.findFirst({
      where: { isCurrentYear: true, branchId },
      select: { id: true },
    }),
  ]);

  const announcementsData = await buildStudentAnnouncementsData(
    branchId,
    organizationId,
    classeIds,
    currentYear?.id ?? null,
  );

  const announcements = announcementsData.items.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    dateStartLabel: item.dateStartLabel,
    audienceLabel: item.audienceLabel,
    audienceScope: item.audienceScope,
    eventTypeName: item.eventTypeName,
  }));

  if (enrollments.length === 0 || !currentYear) {
    return {
      children: mappedChildren,
      finance: emptyFinance,
      satisfaction,
      announcements,
    };
  }

  const [fraisList, selectedExchangeRate, exchangeRates, discount] =
    await Promise.all([
      prisma.frais.findMany({
        where: {
          branchId,
          statusFrais: true,
          schoolYearId: currentYear.id,
          classeId: { in: classeIds },
        },
        select: {
          id: true,
          classeId: true,
          montantFrais: true,
          typeFraisId: true,
        },
      }),
      prisma.exchangeRate.findFirst({
        where: { organizationId, isSelected: true },
        select: { fromCurrency: true },
      }),
      prisma.exchangeRate.findMany({
        where: { organizationId, isActive: true },
        select: {
          fromCurrency: true,
          toCurrency: true,
          rate: true,
          isActive: true,
          isSelected: true,
        },
      }),
      parentId
        ? getBestDiscountInfo(prisma, parentId, branchId)
        : Promise.resolve({
            percentage: 0,
            typeFraisId: null,
            typeFraisName: null,
          }),
    ]);

  const fraisByClasse = new Map<
    string,
    Array<{ id: string; montant: number; typeFraisId: string | null }>
  >();
  const fraisIds: string[] = [];
  for (const frais of fraisList) {
    fraisIds.push(frais.id);
    const list = fraisByClasse.get(frais.classeId) ?? [];
    list.push({
      id: frais.id,
      montant: Number(frais.montantFrais),
      typeFraisId: frais.typeFraisId,
    });
    fraisByClasse.set(frais.classeId, list);
  }

  const enrollmentIds = enrollments.map((e) => e.id);
  const paidByEnrollment = new Map<string, number>();

  if (enrollmentIds.length > 0 && fraisIds.length > 0) {
    const aggregates = await prisma.familyPayment.groupBy({
      by: ["classEnrollmentId"],
      where: {
        branchId,
        classEnrollmentId: { in: enrollmentIds },
        fraisId: { in: fraisIds },
        status: "VALIDE",
      },
      _sum: { amount: true },
    });

    for (const row of aggregates) {
      paidByEnrollment.set(
        row.classEnrollmentId,
        Number(row._sum.amount ?? 0),
      );
    }
  }

  let totalDue = 0;
  let totalPaid = 0;
  let totalRemaining = 0;

  for (const enrollment of enrollments) {
    const classeFrais = fraisByClasse.get(enrollment.classeId) ?? [];
    const montantDuBrut = classeFrais.reduce((sum, f) => sum + f.montant, 0);
    const remise = computeScopedDiscountAmount(
      classeFrais.map((f) => ({
        base: f.montant,
        typeFraisId: f.typeFraisId,
      })),
      discount,
    );
    const montantDu = Math.max(0, montantDuBrut - remise);
    const montantPaye = paidByEnrollment.get(enrollment.id) ?? 0;
    const reste = Math.max(0, montantDu - montantPaye);

    totalDue += montantDu;
    totalPaid += montantPaye;
    totalRemaining += reste;
  }

  return {
    children: mappedChildren,
    finance: {
      totalDue,
      totalPaid,
      totalRemaining,
      currency:
        selectedExchangeRate?.fromCurrency ?? getBaseCurrency(exchangeRates),
    },
    satisfaction,
    announcements,
  };
}

/** Bundle dashboard : blocs chargés selon la variante de rôle (unit-03b). */
export async function getBranchDashboardData(params: {
  branchId: string;
  organizationId: string;
}) {
  // Aligner la session sur l’URL avant lecture (évite « Contexte branche invalide »
  // quand activeBranchId est encore sur une autre école après navigation).
  const switched = await switchActiveBranch(
    params.organizationId,
    params.branchId,
  );
  if (!switched.ok) {
    throw new Error(switched.message || "Contexte branche invalide");
  }

  const session = await getCachedSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Aucune branche active");
  }

  const branch = await prisma.branch.findFirst({
    where: {
      id: params.branchId,
      organizationId: params.organizationId,
    },
    select: {
      id: true,
      typebranch: true,
      educationSystem: true,
      cycles: BRANCH_CYCLE_SELECT,
    },
  });
  if (!branch) {
    throw new Error("Branche introuvable dans cette organisation");
  }

  // Source de vérité = URL (déjà gardée + activée), pas le fallback session.
  const branchId = params.branchId;
  const organizationId = params.organizationId;
  const typebranch = branch.typebranch;
  const educationSystem = branch.educationSystem;
  const cycles = getBranchCycles(branch);

  const variant: DashboardVariant = resolveDashboardVariant(session);
  const blocks = getDashboardDataBlocks(variant);

  const [
    stats,
    metricsResult,
    events,
    feedbackTuple,
    cashier,
    teacher,
    student,
    parent,
  ] = await Promise.all([
    blocks.schoolStats
      ? getAdminStats(params)
      : Promise.resolve({
          typebranch,
          cycles,
          error: null,
        }),
    blocks.pedagogyMetrics
      ? getDashboardMetrics()
      : Promise.resolve([EMPTY_METRICS, null] as const),
    blocks.events ? getBranchEvents(branchId) : Promise.resolve([]),
    blocks.parentFeedback
      ? getParentFeedbackStatus(params)
      : Promise.resolve([
          { showFeedbackPopup: false, alreadySubmitted: false },
          null,
        ] as const),
    blocks.cashier
      ? getCashierDashboardData(branchId, organizationId, userId, session)
      : Promise.resolve(null),
    blocks.teacher
      ? getTeacherDashboardData(branchId, userId)
      : Promise.resolve(null),
    blocks.student
      ? getStudentDashboardData(branchId, userId)
      : Promise.resolve(null),
    blocks.parent
      ? getParentDashboardData(branchId, userId, organizationId)
      : Promise.resolve(null),
  ]);

  const metrics = Array.isArray(metricsResult)
    ? (metricsResult[0] ?? null)
    : metricsResult;
  const feedbackStatus = Array.isArray(feedbackTuple)
    ? (feedbackTuple[0] ?? null)
    : feedbackTuple;

  const statsRecord =
    stats && typeof stats === "object" ? (stats as Record<string, unknown>) : {};

  return {
    variant,
    canAccessFinance: canAccessFinanceArea(session),
    showMyPresence: !isOrganizationOwnerSession(session),
    typebranch:
      (statsRecord.typebranch as string | null | undefined) ?? typebranch,
    educationSystem,
    cycles:
      Array.isArray(statsRecord.cycles) && statsRecord.cycles.length > 0
        ? (statsRecord.cycles as typeof cycles)
        : cycles,
    stats: blocks.schoolStats ? stats : null,
    metrics:
      blocks.pedagogyMetrics &&
      metrics &&
      typeof metrics === "object" &&
      !("error" in (metrics as object))
        ? metrics
        : blocks.pedagogyMetrics
          ? EMPTY_METRICS
          : null,
    events,
    feedbackStatus,
    cashier,
    teacher,
    student,
    parent,
  };
}

export async function getParentFeedbackStatus({
  branchId,
  organizationId,
}: z.infer<typeof adminStatsSchema>) {
  try {
    const user = await getSessionUser();

    if (!user?.id) {
      return [null, "UNAUTHORIZED"] as const;
    }

    // =========================
    // VERIFY BRANCH ↔ ORGANIZATION
    // =========================
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId,
      },
      select: { id: true },
    });

    if (!branch) {
      return [null, "BRANCH_NOT_FOUND"] as const;
    }

    const month = new Date().getMonth() + 1;

    // =========================
    // GET CURRENT SCHOOL YEAR (SAFE)
    // =========================
    const currentYear = await prisma.schoolYear.findFirst({
      where: {
        isCurrentYear: true,
        branchId: branch.id,
      },
      select: { id: true },
    });

    if (!currentYear) {
      return [null, "SCHOOL_YEAR_NOT_FOUND"] as const;
    }

    // Parent de cette branche (avis à la 1ʳᵉ connexion du mois).
    const parent = await prisma.parent.findFirst({
      where: {
        branchMember: {
          branchId: branch.id,
          member: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!parent) {
      // Pas un parent de cette branche → pas de popup.
      return [
        {
          showFeedbackPopup: false,
          alreadySubmitted: false,
        },
        null,
      ] as const;
    }

    const existing = await prisma.parentFeedback.findFirst({
      where: {
        parentId: parent.id,
        month,
        schoolYearId: currentYear.id,
        branchId: branch.id,
      },
      select: {
        id: true,
      },
    });

    return [
      {
        showFeedbackPopup: !existing,
        alreadySubmitted: !!existing,
      },
      null,
    ] as const;
  } catch (error) {
    console.error("getParentFeedbackStatus error:", error);
    return [null, "SERVER_ERROR"] as const;
  }
}

export async function createParentFeedback(
  rating: number,
  comment?: string | null,
) {
  try {
    const user = await getSessionUser();
    const currentUserId = user?.id ?? null;

    if (!currentUserId) {
      return { error: "UNAUTHORIZED" };
    }

    if (
      typeof rating !== "number" ||
      !Number.isFinite(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return { error: "INVALID_RATING" };
    }

    const now = new Date();
    const month = now.getMonth() + 1;

    // Préférer la branche active de session (évite un parent d'une autre école).
    let activeBranchId: string | null = null;
    try {
      const ctx = await requireBranchContext();
      activeBranchId = ctx.branchId;
    } catch {
      activeBranchId = null;
    }

    const parent = await prisma.parent.findFirst({
      where: {
        branchMember: {
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          member: {
            userId: currentUserId,
          },
        },
      },
      select: {
        id: true,
        branchMember: {
          select: {
            branchId: true,
          },
        },
      },
    });

    if (!parent?.branchMember?.branchId) {
      return { error: "PARENT_NOT_FOUND" };
    }

    const branchId = parent.branchMember.branchId;

    const currentYear = await prisma.schoolYear.findFirst({
      where: {
        isCurrentYear: true,
        branchId,
      },
      select: {
        id: true,
      },
    });

    if (!currentYear) {
      return { error: "NO_ACTIVE_SCHOOL_YEAR" };
    }

    const existing = await prisma.parentFeedback.findFirst({
      where: {
        parentId: parent.id,
        month,
        schoolYearId: currentYear.id,
        branchId,
      },
      select: { id: true },
    });

    if (existing) {
      return { error: "ALREADY_SUBMITTED" };
    }

    const feedback = await prisma.parentFeedback.create({
      data: {
        parentId: parent.id,
        rating,
        comment: comment ?? null,
        month,
        schoolYearId: currentYear.id,
        branchId,
      },
    });

    const satisfaction = await getParentAnnualSatisfaction(
      branchId,
      currentUserId,
    );

    return { data: feedback, satisfaction };
  } catch (error) {
    console.error("createParentFeedback error:", error);
    return { error: "SERVER_ERROR" };
  }
}

export async function createStudentGrades(periodId: number) {
  try {
    const { branchId } = await requireBranchContext();
    const { generateStudentGradesForPeriod } = await import(
      "@/src/server/cron/gradeCron"
    );

    const success = await generateStudentGradesForPeriod(periodId, branchId);
    if (!success) {
      return { error: "NO_GRADES_GENERATED" };
    }

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "SERVER_ERROR" };
  }
}
