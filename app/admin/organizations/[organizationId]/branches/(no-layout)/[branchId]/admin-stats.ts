"use server";

import { auth } from "@/lib/auth";
import {
  calculateBulletinPercentage,
  sumBulletinMaxima,
} from "@/lib/bulletin-maxima";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { action } from "@/lib/zsa";
import { headers } from "next/headers";
import { z } from "zod";

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
      select: { id: true },
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
      return {
        error: "NO_CURRENT_SCHOOL_YEAR",
      };
    }

    // =========================
    // HELPERS (GROUPBY WRAPPER)
    // =========================
    const uniqueStudentsCurrent = await prisma.classEnrollment.groupBy({
      by: ["studentId"],
      where: {
        schoolYearId: currentYear.id,
        branchId: branch.id,
        statusEnrollment: true,
        createdAt: { lte: endCurrent },
      },
    });

    const uniqueStudentsPrev = await prisma.classEnrollment.groupBy({
      by: ["studentId"],
      where: {
        schoolYearId: currentYear.id,
        branchId: branch.id,
        statusEnrollment: true,
        createdAt: { lte: endPrev },
      },
    });

    const uniqueClassesCurrent = await prisma.classEnrollment.groupBy({
      by: ["classeId"],
      where: {
        schoolYearId: currentYear.id,
        branchId: branch.id,
        statusEnrollment: true,
        createdAt: { lte: endCurrent },
      },
    });

    const uniqueClassesPrev = await prisma.classEnrollment.groupBy({
      by: ["classeId"],
      where: {
        schoolYearId: currentYear.id,
        branchId: branch.id,
        statusEnrollment: true,
        createdAt: { lte: endPrev },
      },
    });

    const uniqueTeachersCurrent = await prisma.teaching.groupBy({
      by: ["teacherId"],
      where: {
        schoolYearId: currentYear.id,
        branchId: branch.id,
        statusTeaching: true,
        createdAt: { lte: endCurrent },
      },
    });

    const uniqueTeachersPrev = await prisma.teaching.groupBy({
      by: ["teacherId"],
      where: {
        schoolYearId: currentYear.id,
        branchId: branch.id,
        statusTeaching: true,
        createdAt: { lte: endPrev },
      },
    });

    // =========================
    // PARALLEL SIMPLE COUNTS
    // =========================
    const [
      totalStudentsCurrent,
      totalStudentsPrev,
      classesTotal,
      teachersTotal,
      coursesTotal,
      revenueCurrentAgg,
      revenuePrevAgg,
    ] = await Promise.all([
      prisma.student.count({
        where: {
          branchMember: { branchId: branch.id },
          createdAt: { lte: endCurrent },
        },
      }),

      prisma.student.count({
        where: {
          branchMember: { branchId: branch.id },
          createdAt: { lte: endPrev },
        },
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

      prisma.familyPayment.aggregate({
        _sum: { amount: true },
        where: {
          branchId: branch.id,
          status: "VALIDE",
          createdAt: { lte: endCurrent },
        },
      }),

      prisma.familyPayment.aggregate({
        _sum: { amount: true },
        where: {
          branchId: branch.id,
          status: "VALIDE",
          createdAt: { lte: endPrev },
        },
      }),
    ]);

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
    // REVENUE
    // =========================
    const revenueCurrent = revenueCurrentAgg._sum.amount ?? 0;
    const revenuePrev = revenuePrevAgg._sum.amount ?? 0;

    // =========================
    // RETURN
    // =========================
    return {
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

      revenue: {
        current: revenueCurrent,
        previous: revenuePrev,
        percentageChange: calcPercentage(revenueCurrent, revenuePrev),
      },

      attendance: 0,
    };
  } catch (error) {
    console.error("getAdminStats error:", error);

    return {
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
      },

      attendance: 0,
    };
  }
}

export const getDashboardMetrics = action.handler(async () => {
  const { branchId } = await requireBranchContext();

  const currentYear = await prisma.schoolYear.findFirst({
    where: { isCurrentYear: true, branchId },
  });

  const currentMonth = new Date().getMonth() + 1;

  let attendance = 0;
  let attendanceCount = 0;
  let successRate = 0;
  let averageScore = 0;
  let studentsCount = 0;
  let passedCount = 0;
  let satisfaction = 0;
  let feedbackCount = 0;
  let parentsCount = 0;
  let responseRate = 0;

  try {
    // Présents + retards comptent comme présence effective.
    const [totalAttendance, presentOrLate] = await Promise.all([
      prisma.studentAttendance.count({ where: { branchId } }),
      prisma.studentAttendance.count({
        where: {
          branchId,
          status: { in: ["PRESENT", "LATE"] },
        },
      }),
    ]);
    attendanceCount = totalAttendance;
    attendance =
      totalAttendance > 0
        ? Math.round((presentOrLate / totalAttendance) * 100)
        : 0;
  } catch (error) {
    console.error("getDashboardMetrics attendance:", error);
  }

  try {
    let averages = await getBranchStudentAverages({
      branchId,
      yearId: currentYear?.id,
    });
    if (averages.length === 0) {
      averages = await getBranchStudentAverages({ branchId });
    }

    studentsCount = averages.length;
    passedCount = averages.filter(
      (avg) => avg >= SUCCESS_THRESHOLD_PERCENT,
    ).length;
    // Barre principale = moyenne générale (tous cours / maxima période).
    averageScore =
      studentsCount > 0
        ? Math.round(
            (averages.reduce((sum, avg) => sum + avg, 0) / studentsCount) * 10,
          ) / 10
        : 0;
    successRate =
      studentsCount > 0 ? Math.round((passedCount / studentsCount) * 100) : 0;
  } catch (error) {
    console.error("getDashboardMetrics successRate:", error);
  }

  try {
    // Avis mensuels : satisfaction = % d'avis positifs (≥4) parmi les avis reçus.
    // Taux de réponse = parents ayant donné leur avis ce mois / total parents.
    const [totalParents, yearFeedbacks, monthFeedbacks] = await Promise.all([
      prisma.parent.count({
        where: { branchMember: { branchId } },
      }),
      prisma.parentFeedback.findMany({
        where: {
          branchId,
          ...(currentYear?.id ? { schoolYearId: currentYear.id } : {}),
        },
        select: { rating: true, month: true },
      }),
      prisma.parentFeedback.count({
        where: {
          branchId,
          month: currentMonth,
          ...(currentYear?.id ? { schoolYearId: currentYear.id } : {}),
        },
      }),
    ]);

    parentsCount = totalParents;
    feedbackCount = yearFeedbacks.length;
    const satisfiedCount = yearFeedbacks.filter((f) => f.rating >= 4).length;

    satisfaction =
      feedbackCount > 0
        ? Math.round((satisfiedCount / feedbackCount) * 100)
        : 0;

    responseRate =
      totalParents > 0
        ? Math.round((monthFeedbacks / totalParents) * 100)
        : 0;
  } catch (error) {
    console.error("getDashboardMetrics satisfaction:", error);
  }

  return {
    attendance,
    attendanceCount,
    successRate,
    averageScore,
    studentsCount,
    passedCount,
    satisfaction,
    feedbackCount,
    parentsCount,
    responseRate,
  };
});

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

    // Parent lié à l'utilisateur (rôle plateforme peut être "user").
    const parent = await prisma.parent.findFirst({
      where: {
        branchMember: {
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

    return { data: feedback };
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
