import { Worker } from "bullmq";

import { getRedisConnection } from "../redis/redis";
import { isDeliverableMailbox } from "@/lib/email/deliverable-mailbox";
import { deliverMail, type MailPayload } from "@/lib/email/mailer";
import {
  isSmtpOutboundSuspended,
  logSmtpSkip,
} from "@/lib/email/smtp-circuit";

const EMAIL_QUEUE_NAME = "email-queue";

export const emailWorker = new Worker<MailPayload>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    const { to, subject } = job.data;

    if (!isDeliverableMailbox(to)) {
      console.info(
        `⏭️  Email skip job ${job.id} → ${to} (boîte non livrable, ${subject})`,
      );
      return;
    }

    if (isSmtpOutboundSuspended()) {
      logSmtpSkip(to, subject);
      return;
    }

    console.log(`✉️  Sending email job ${job.id} → ${to} (${subject})`);
    await deliverMail(job.data);

    if (isSmtpOutboundSuspended()) {
      logSmtpSkip(to, subject);
      return;
    }

    console.log(`✅ Email sent job ${job.id} → ${to}`);
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  },
);

emailWorker.on("failed", (job, error) => {
  console.error(
    `❌ Email job ${job?.id ?? "?"} failed:`,
    error instanceof Error ? error.message : error,
  );
});

console.log("👷 Email worker running...");
