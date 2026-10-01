import cron from "node-cron";
import { dispatchMonthlyParentSatisfaction } from "@/lib/satisfaction/parent-satisfaction";

let started = false;

export function startParentSatisfactionCron() {
  if (started) return;
  started = true;

  cron.schedule("0 8 * * *", async () => {
    try {
      const now = new Date();
      const day = now.getDate();
      if (day !== 1 && day !== 15) return;
      const result = await dispatchMonthlyParentSatisfaction();
      console.log(
        `[parent-satisfaction] day=${day} targets=${result.targets} dispatched=${result.dispatched}`,
      );
    } catch (error) {
      console.error("[parent-satisfaction] cron failed", error);
    }
  });

  console.log("⏰ Parent satisfaction cron started (daily 08:00)");
}
