import cron from "node-cron";
import { prisma } from "@/lib/prisma";

let isRunning = false;

/**
 * LOCK TABLE (anti double processing par période)
 */
async function isPeriodLocked(periodId: number) {
  const lock = await prisma.periodResultLock.findUnique({
    where: { periodId },
  });

  return !!lock;
}

async function lockPeriod(periodId: number, branchId: string) {
  try {
    const existing = await prisma.periodResultLock.findUnique({
      where: {
        branchId_periodId: {
          periodId,
          branchId,
        },
      },
    });

    if (existing?.status === "DONE") return "DONE";
    if (existing?.status === "PROCESSING") return "PROCESSING";

    await prisma.periodResultLock.upsert({
      where: {
        branchId_periodId: {
          periodId,
          branchId,
        },
      },
      update: {
        status: "PROCESSING",
      },
      create: {
        periodId,
        branchId,
        status: "PROCESSING",
      },
    });

    return "LOCKED";
  } catch (e) {
    throw e;
  }
}

async function finishLock(periodId: number) {
  await prisma.periodResultLock.updateMany({
    where: { periodId },
    data: {
      status: "DONE",
      createdAt: new Date(),
    },
  });
}

async function acquireLock(periodId: number, branchId: string) {
  return prisma.$transaction(async (tx) => {
    const lock = await tx.periodResultLock.findFirst({
      where: {
        periodId,
        branchId,
      },
    });

    // DONE = verrou final
    if (lock?.status === "DONE") {
      return "DONE";
    }

    // PROCESSING encore actif → bloqué
    if (lock?.status === "PROCESSING") {
      return "PROCESSING";
    }

    // lock atomique
    await tx.periodResultLock.upsert({
      where: {
        branchId_periodId: {
          periodId,
          branchId,
        },
      },
      update: {
        status: "PROCESSING",
        createdAt: new Date(),
      },
      create: {
        periodId,
        branchId,
        status: "PROCESSING",
        createdAt: new Date(),
      },
    });

    return "LOCKED";
  });
}
function isLockStale(lock: any) {
  if (!lock?.createdAt) return false;

  const now = Date.now();
  const lockedAt = new Date(lock.createdAt).getTime();

  // 10 minutes timeout
  return now - lockedAt > 10 * 60 * 1000;
}
/**
 * GENERATE GRADES
 */
export async function generateStudentGradesForPeriod(
  periodId: number,
  branchId: string,
) {
  try {
    // Tous les cours de la période (maxima de période dans chaque fiche).
    const fiches = await prisma.fiche.findMany({
      where: {
        branchId,
        periodId,
        typeFiche: "ficheCote",
      },
      select: {
        id: true,
        notes: true,
        anneeId: true,
        classSectionId: true,
        branchId: true,
      },
    });

    if (!fiches.length) {
      console.log(`⚠️ No fiches for period ${periodId}`);
      return false;
    }

    const byClass = new Map<string, typeof fiches>();
    for (const fiche of fiches) {
      const list = byClass.get(fiche.classSectionId) ?? [];
      list.push(fiche);
      byClass.set(fiche.classSectionId, list);
    }

    let upserted = 0;

    for (const [, classFiches] of byClass.entries()) {
      const schoolYearId = classFiches[0]?.anneeId;
      if (!schoolYearId) continue;

      const studentMap = new Map<
        string,
        {
          totalScore: number;
          totalMax: number;
        }
      >();

      for (const fiche of classFiches) {
        let notesParsed: any[] = [];

        try {
          notesParsed =
            typeof fiche.notes === "string"
              ? JSON.parse(fiche.notes)
              : Array.isArray(fiche.notes)
                ? fiche.notes
                : [];
        } catch {
          continue;
        }

        if (!notesParsed.length) continue;

        const coursePeriodMax = Math.max(
          0,
          ...notesParsed.map((note: any) => {
            const max = Number(note?.maxScore ?? 0);
            return Number.isFinite(max) && max > 0 ? max : 0;
          }),
        );

        if (!(coursePeriodMax > 0)) continue;

        for (const note of notesParsed) {
          if (!note?.studentId) continue;

          const score = Number(note.score ?? 0);
          const noteMax = Number(note.maxScore ?? 0);
          const maxScore =
            Number.isFinite(noteMax) && noteMax > 0
              ? noteMax
              : coursePeriodMax;

          const current = studentMap.get(note.studentId) || {
            totalScore: 0,
            totalMax: 0,
          };

          current.totalScore += Number.isFinite(score) ? score : 0;
          current.totalMax += maxScore;

          studentMap.set(note.studentId, current);
        }
      }

      for (const [studentId, result] of studentMap.entries()) {
        const raw =
          result.totalMax > 0
            ? (result.totalScore / result.totalMax) * 100
            : 0;
        const percentageInt = Number.isFinite(raw) ? Math.round(raw) : 0;

        await prisma.studentGrade.upsert({
          where: {
            studentId_periodId_branchId: {
              studentId,
              periodId,
              branchId,
            },
          },
          update: {
            score: percentageInt,
            schoolYearId,
          },
          create: {
            studentId,
            branchId,
            schoolYearId,
            periodId,
            score: percentageInt,
          },
        });
        upserted += 1;
      }
    }

    if (upserted === 0) {
      console.log("⚠️ studentMap empty");
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ GENERATE ERROR", error);
    return false;
  }
}
/**
 * CRON START
 */
export function startGradeCron() {
  if (isRunning) {
    console.log("⚠️ Cron already started, skipping...");
    return;
  }

  isRunning = true;

  // cron.schedule("*/1 * * * *", async () => {
  //   console.log("🔄 Grade Cron running...");

  //   const periods = await prisma.period.findMany();

  //   for (const period of periods) {
  //     try {
  //       // 🔥 anti double lock DB
  //       const lockStatus = await lockPeriod(period.id);

  //       if (lockStatus === "DONE") {
  //         continue;
  //       }

  //       if (lockStatus === "PROCESSING") {
  //         console.log("already running");
  //         continue;
  //       }

  //       const success = await generateStudentGradesForPeriod(period.id);

  //       if (success) {
  //         await finishLock(period.id);
  //       } else {
  //         await prisma.periodResultLock.update({
  //           where: { periodId: period.id },
  //           data: { status: "FAILED" },
  //         });
  //       }
  //     } catch (e) {
  //       console.error(`❌ Error period ${period.id}`, e);
  //     }
  //   }

  //   console.log("✔ Grade Cron finished");
  // });
  cron.schedule("*/60 * * * *", async () => {
    console.log("🔄 Cron running...");

    const periods = await prisma.period.findMany();

    for (const period of periods) {
      try {
        const lock = await prisma.periodResultLock.findFirst({
          where: { periodId: period.id, branchId: period.branchId },
        });

        // 🔥 DONE = jamais rejoué
        if (lock?.status === "DONE") continue;

        // 🔥 SAFE UNLOCK si stuck PROCESSING
        if (lock?.status === "PROCESSING" && isLockStale(lock)) {
          console.log(`♻️ unlocking stale period ${period.id}`);

          await prisma.periodResultLock.update({
            where: {
              branchId_periodId: {
                periodId: period.id,
                branchId: period.branchId,
              },
            },
            data: {
              status: "FAILED",
            },
          });
        }

        const lockResult = await acquireLock(period.id, period.branchId);

        if (lockResult === "DONE") continue;
        if (lockResult === "PROCESSING") continue;

        // 🚀 JOB EXECUTION
        const success = await generateStudentGradesForPeriod(
          period.id,
          period.branchId,
        );

        await prisma.periodResultLock.update({
          where: {
            branchId_periodId: {
              periodId: period.id,
              branchId: period.branchId,
            },
          },
          data: {
            status: success ? "DONE" : "FAILED",
          },
        });
      } catch (e) {
        console.error("❌ period error", period.id, e);

        await prisma.periodResultLock.update({
          where: {
            branchId_periodId: {
              periodId: period.id,
              branchId: period.branchId,
            },
          },
          data: { status: "FAILED" },
        });
      }
    }

    console.log("✔ Cron finished");
  });
}
