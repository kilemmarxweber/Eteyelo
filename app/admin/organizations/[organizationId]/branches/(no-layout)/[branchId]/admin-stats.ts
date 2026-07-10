"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { action } from "@/lib/zsa";
import { headers } from "next/headers";
import { z } from "zod";
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
  const totalAttendance = await prisma.studentAttendance.count();

  const presents = await prisma.studentAttendance.count({
    where: {
      status: "PRESENT",
    },
  });

  const attendance =
    totalAttendance > 0 ? Math.round((presents / totalAttendance) * 100) : 0;

  const currentYear = await prisma.schoolYear.findFirst({
    where: { isCurrentYear: true, branchId },
  });

  const totalGrades = await prisma.studentGrade.count({
    where: {
      branchId,
      schoolYearId: currentYear?.id,
    },
  });

  const passed = await prisma.studentGrade.count({
    where: {
      branchId,
      schoolYearId: currentYear?.id,
      score: {
        gte: 50,
      },
    },
  });

  const successRate =
    totalGrades > 0 ? Math.round((passed / totalGrades) * 100) : 0;

  const totalParents = await prisma.parent.count();

  const feedbacks = await prisma.parentFeedback.findMany({
    where: {
      schoolYearId: currentYear?.id,
    },
    select: {
      rating: true,
    },
  });

  const satisfiedCount = feedbacks.filter((f) => f.rating >= 4).length;

  // nombre de mois déjà écoulés dans l'année scolaire
  const now = new Date();

  const startDate = new Date(currentYear?.startYear || 0);

  let elapsedMonths =
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth()) +
    1;

  // sécurité
  elapsedMonths = Math.max(1, elapsedMonths);
  elapsedMonths = Math.min(elapsedMonths, 9);

  const possibleFeedbacks = totalParents * elapsedMonths;

  const satisfaction =
    possibleFeedbacks > 0
      ? Math.round((satisfiedCount / possibleFeedbacks) * 100)
      : 0;

  return {
    attendance,
    successRate,
    satisfaction,
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

    // =========================
    // GET PARENT VIA BRANCH MEMBER (IMPORTANT FIX)
    // =========================
    const parent = await prisma.parent.findFirst({
      where: {
        branchMember: {
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
      return [null, "PARENT_NOT_FOUND"] as const;
    }

    // =========================
    // CHECK EXISTING FEEDBACK
    // =========================
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

    if (user?.role !== "parent") {
      return { error: "FORBIDDEN" };
    }

    const now = new Date();
    const month = now.getMonth() + 1;

    // =========================
    // GET CURRENT SCHOOL YEAR (SAFE)
    // =========================
    const currentYear = await prisma.schoolYear.findFirst({
      where: {
        isCurrentYear: true,
      },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (!currentYear) {
      return { error: "NO_ACTIVE_SCHOOL_YEAR" };
    }

    // =========================
    // GET PARENT VIA BRANCH CHAIN (FIX IMPORTANT)
    // =========================
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
      },
    });

    if (!parent) {
      return { error: "PARENT_NOT_FOUND" };
    }

    // =========================
    // CHECK DUPLICATE FEEDBACK (SCOPED)
    // =========================
    const existing = await prisma.parentFeedback.findFirst({
      where: {
        parentId: parent.id,
        month,
        schoolYearId: currentYear.id,
        branchId: currentYear.branchId,
      },
      select: { id: true },
    });

    if (existing) {
      return { error: "ALREADY_SUBMITTED" };
    }

    // =========================
    // CREATE FEEDBACK
    // =========================
    const feedback = await prisma.parentFeedback.create({
      data: {
        parentId: parent.id,
        rating,
        comment: comment ?? null,
        month,
        schoolYearId: currentYear.id,
        branchId: currentYear.branchId,
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
    const currentYear = await prisma.schoolYear.findFirst({
      where: {
        isCurrentYear: true,
      },
      select: { id: true },
    });

    if (!currentYear) {
      return { error: "NO_CURRENT_YEAR" };
    }

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        schoolYearId: currentYear.id,
        statusEnrollment: true,
      },
      select: {
        studentId: true,
        branchId: true,
      },
    });

    const fiches = await prisma.fiche.findMany({
      where: {
        periodId,
        anneeId: currentYear.id,
      },
    });

    for (const enrollment of enrollments) {
      let total = 0;
      let count = 0;

      for (const fiche of fiches) {
        try {
          if (!fiche.notes) continue;

          const notes = JSON.parse(fiche.notes);

          const note = notes.find(
            (n: any) => n.studentId === enrollment.studentId,
          );

          if (note) {
            total += Number(note.note);
            count++;
          }
        } catch {
          continue;
        }
      }

      if (count === 0) continue;

      const moyenne = Number((total / count).toFixed(2));

      await prisma.studentGrade.upsert({
        where: {
          studentId_periodId_branchId: {
            studentId: enrollment.studentId,
            periodId,
            branchId: enrollment.branchId,
          },
        },
        update: {
          score: moyenne,
        },
        create: {
          studentId: enrollment.studentId,
          periodId,
          schoolYearId: currentYear.id,
          score: moyenne,
          branchId: enrollment.branchId,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "SERVER_ERROR" };
  }
}
