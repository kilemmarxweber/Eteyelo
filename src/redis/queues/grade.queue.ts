// src/queues/grade.queue.ts
import "server-only";
import { Queue } from "bullmq";
import { getRedisConnection, onRedisConnectionReset } from "../redis";

let _gradeQueue: Queue | null = null;
let _resetBound = false;

function bindReset() {
  if (_resetBound) return;
  _resetBound = true;
  onRedisConnectionReset(() => {
    if (_gradeQueue) {
      void _gradeQueue.close().catch(() => undefined);
      _gradeQueue = null;
    }
  });
}

export function getGradeQueue() {
  bindReset();
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
