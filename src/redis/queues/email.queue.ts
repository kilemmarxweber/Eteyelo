import "server-only";

import { Queue } from "bullmq";

import { getRedisConnection } from "../redis";
import type { MailPayload } from "@/lib/email/mailer";

export const EMAIL_QUEUE_NAME = "email-queue";

export type EmailJobPayload = MailPayload;

let _emailQueue: Queue<EmailJobPayload> | null = null;

export function getEmailQueue() {
  if (!_emailQueue) {
    _emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
      connection: getRedisConnection() as any,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 3000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return _emailQueue;
}

/** @deprecated Préférer getEmailQueue() */
export const emailQueue = new Proxy({} as Queue<EmailJobPayload>, {
  get(_target, prop, receiver) {
    const queue = getEmailQueue();
    const value = Reflect.get(queue, prop, receiver);
    return typeof value === "function" ? value.bind(queue) : value;
  },
});
