/**
 * Point d'entrée unique des workers BullMQ (notes + emails).
 * Usage : `pnpm worker`
 */
import "./grade.worker";
import "./email.worker";

console.log("👷 All workers started (grade + email)");
