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

async function lockPeriod(periodId: number) {
  try {
    const existing = await prisma.periodResultLock.findUnique({
      where: { periodId },
    });

    if (existing?.status === "DONE") return "DONE";
    if (existing?.status === "PROCESSING") return "PROCESSING";

    await prisma.periodResultLock.upsert({
      where: { periodId },
      update: {
        status: "PROCESSING",
      },
      create: {
        periodId,
        status: "PROCESSING",
      },
    });

    return "LOCKED";
  } catch (e) {
    throw e;
  }
}

async function finishLock(periodId: number) {
  await prisma.periodResultLock.update({
    where: { periodId },
    data: {
      status: "DONE",
      createdAt: new Date(),
    },
  });
}

async function acquireLock(periodId: number) {
  return prisma.$transaction(async (tx) => {
    const lock = await tx.periodResultLock.findUnique({
      where: { periodId },
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
      where: { periodId },
      update: {
        status: "PROCESSING",
        createdAt: new Date(),
      },
      create: {
        periodId,
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
export async function generateStudentGradesForPeriod(periodId: number) {
  try {
    const fiches = await prisma.fiche.findMany({
      where: {
        periodId,
        typeFiche: "ficheCote",
      },
      select: {
        id: true,
        notes: true,
        anneeId: true,
        status: true,
        classSectionId: true,
      },
    });

    if (!fiches.length) {
      console.log(`⚠️ No validated fiches for period ${periodId}`);
      return false;
    }
    const expectedCount = await prisma.teaching.count({
      where: {
        schoolYearId: fiches[0].anneeId,
        classeId: fiches[0].classSectionId,
      },
    });
    // 🔥 CHECK D'INTÉGRITÉ ICI (IMPORTANT)
    const valid = fiches.filter((f) => f.status === true);

    if (valid.length !== expectedCount) {
      console.log(
        `⛔ Period ${periodId} incomplete: ${valid.length}/${expectedCount}`,
      );
      return false; // STOP ICI
    }

    const schoolYearId = fiches[0].anneeId;

    const studentMap = new Map<
      string,
      {
        totalScore: number;
        totalMax: number;
      }
    >();

    for (const fiche of valid) {
      let notesParsed: any[] = [];

      try {
        notesParsed =
          typeof fiche.notes === "string"
            ? JSON.parse(fiche.notes)
            : Array.isArray(fiche.notes)
              ? fiche.notes
              : [];
      } catch (error) {
        continue;
      }

      for (const note of notesParsed) {
        if (!note?.studentId) {
          console.log("NO STUDENT ID");
          continue;
        }

        const score = Number(note.score ?? 0);
        const maxScore = Number(note.maxScore ?? 0);

        const current = studentMap.get(note.studentId) || {
          totalScore: 0,
          totalMax: 0,
        };

        current.totalScore += score;
        current.totalMax += maxScore;

        studentMap.set(note.studentId, current);
      }
    }

    if (studentMap.size === 0) {
      console.log("⚠️ studentMap empty");
      return false;
    }
    for (const [studentId, data] of studentMap.entries()) {
      console.log("🧑 STUDENT:", studentId);
      console.log("TOTAL SCORE:", data.totalScore);
      console.log("TOTAL MAX:", data.totalMax);
    }
    for (const [studentId, result] of studentMap.entries()) {
      // const percentage =
      //   result.totalMax > 0
      //     ? Math.round((result.totalScore / result.totalMax) * 100)
      //     : 0;
      const raw = (result.totalScore / result.totalMax) * 100;

      const percentageInt = Number.isFinite(raw) ? Math.round(raw) : 0;
      await prisma.studentGrade.upsert({
        where: {
          studentId_periodId: {
            studentId,
            periodId,
          },
        },
        update: {
          score: percentageInt,
        },
        create: {
          studentId,
          schoolYearId,
          periodId,
          score: percentageInt,
        },
      });
    }
    return true; // 👈 succès réel
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
        const lock = await prisma.periodResultLock.findUnique({
          where: { periodId: period.id },
        });

        // 🔥 DONE = jamais rejoué
        if (lock?.status === "DONE") continue;

        // 🔥 SAFE UNLOCK si stuck PROCESSING
        if (lock?.status === "PROCESSING" && isLockStale(lock)) {
          console.log(`♻️ unlocking stale period ${period.id}`);

          await prisma.periodResultLock.update({
            where: { periodId: period.id },
            data: {
              status: "FAILED",
            },
          });
        }

        const lockResult = await acquireLock(period.id);

        if (lockResult === "DONE") continue;
        if (lockResult === "PROCESSING") continue;

        // 🚀 JOB EXECUTION
        const success = await generateStudentGradesForPeriod(period.id);

        await prisma.periodResultLock.update({
          where: { periodId: period.id },
          data: {
            status: success ? "DONE" : "FAILED",
          },
        });
      } catch (e) {
        console.error("❌ period error", period.id, e);

        await prisma.periodResultLock.update({
          where: { periodId: period.id },
          data: { status: "FAILED" },
        });
      }
    }

    console.log("✔ Cron finished");
  });
}
