import { Worker } from "bullmq";
import { connection } from "../redis/redis";
import { prisma } from "@/lib/prisma";
import { generateStudentGradesForPeriod } from "../server/cron/gradeCron";

export const gradeWorker = new Worker(
  "grade-queue",
  async (job) => {
    const { periodId } = job.data;

    console.log("🚀 Processing period:", periodId);

    // 🔒 LOCK (IMPORTANT ICI)
    const lock = await prisma.periodResultLock.upsert({
      where: { periodId },
      update: {
        status: "PROCESSING",
      },
      create: {
        periodId,
        status: "PROCESSING",
      },
    });

    if (lock.status === "DONE") {
      console.log("⛔ Already done:", periodId);
      return;
    }

    try {
      const success = await generateStudentGradesForPeriod(periodId);

      await prisma.periodResultLock.update({
        where: { periodId },
        data: {
          status: success ? "DONE" : "FAILED",
        },
      });

      return success;
    } catch (e) {
      await prisma.periodResultLock.update({
        where: { periodId },
        data: { status: "FAILED" },
      });

      throw e;
    }
  },
  {
    connection,
  },
);

console.log("👷 Grade worker running...");
