// src/services/grade.service.ts
import { gradeQueue } from "../queues/grade.queue";

export async function onFicheValidated(periodId: number) {
  await gradeQueue.add(
    "generate-grades",
    { periodId },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
    },
  );
}
