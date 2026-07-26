// src/queues/grade.queue.ts
import "server-only";
import { Queue } from "bullmq";
import { getRedisConnection } from "../redis";

let _gradeQueue: Queue | null = null;

export function getGradeQueue() {
  if (!_gradeQueue) {
    _gradeQueue = new Queue("grade-queue", {
      connection: getRedisConnection() as any,
    });
  }
  return _gradeQueue;
}

/** @deprecated Préférer getGradeQueue() */
export const gradeQueue = new Proxy({} as Queue, {
  get(_target, prop, receiver) {
    const queue = getGradeQueue();
    const value = Reflect.get(queue, prop, receiver);
    return typeof value === "function" ? value.bind(queue) : value;
  },
});
