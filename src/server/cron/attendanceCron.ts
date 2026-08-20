import cron from "node-cron";
import { signalEndedAbsencesForAllBranches } from "@/lib/attendance-absence";

let started = false;

export function startAttendanceAbsenceCron() {
  if (started) return;
  started = true;

  cron.schedule("*/15 * * * *", async () => {
    try {
      const result = await signalEndedAbsencesForAllBranches();
      console.log(
        `[attendance-absence] branches=${result.branches} created=${result.created}`,
      );
    } catch (error) {
      console.error("[attendance-absence] cron failed", error);
    }
  });

  console.log("⏰ Attendance absence cron started (every 15 min)");
}
