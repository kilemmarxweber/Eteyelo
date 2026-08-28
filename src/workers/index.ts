/**
 * Point d'entrée unique des workers BullMQ (notes + emails).
 * Usage : `pnpm worker`
 */
import "./stub-server-only";
import "./grade.worker";
import "./email.worker";
import { startAttendanceAbsenceCron } from "../server/cron/attendanceCron";

startAttendanceAbsenceCron();

console.log("👷 All workers started (grade + email + attendance)");
