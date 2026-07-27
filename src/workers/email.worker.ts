import { Worker } from "bullmq";

import { getRedisConnection } from "../redis/redis";
import { deliverMail, type MailPayload } from "@/lib/email/mailer";

const EMAIL_QUEUE_NAME = "email-queue";

export const emailWorker = new Worker<MailPayload>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    const { to, subject } = job.data;
    console.log(`✉️  Sending email job ${job.id} → ${to} (${subject})`);
    await deliverMail(job.data);
    console.log(`✅ Email sent job ${job.id} → ${to}`);
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 3,
  },
);

emailWorker.on("failed", (job, error) => {
  console.error(
    `❌ Email job ${job?.id ?? "?"} failed:`,
    error instanceof Error ? error.message : error,
  );
});

console.log("👷 Email worker running...");
