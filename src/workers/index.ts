/**
 * Point d'entrée unique des workers BullMQ (notes + emails).
 * Usage : `pnpm worker`
 */
import "./stub-server-only";
import "./grade.worker";
import "./email.worker";
import { startAttendanceAbsenceCron } from "../server/cron/attendanceCron";
import { startOwnerDailyFinanceCron } from "../server/cron/ownerDailyFinanceCron";
import { startParentSatisfactionCron } from "../server/cron/parentSatisfactionCron";

startAttendanceAbsenceCron();
startOwnerDailyFinanceCron();
startParentSatisfactionCron();

console.log(
  "👷 All workers started (grade + email + attendance + owner finance + parent satisfaction)",
);
