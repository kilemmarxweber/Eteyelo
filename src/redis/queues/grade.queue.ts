// src/queues/grade.queue.ts
import { Queue } from "bullmq";
import { connection } from "../redis";

export const gradeQueue = new Queue("grade-queue", {
  connection,
});
