import "server-only";

import { ensureRedisReady } from "../redis";
import { getGradeQueue } from "../queues/grade.queue";

export async function onFicheValidated(periodId: number) {
  await enqueueGenerateGrades(periodId);
}

/**
 * Met en file le recalcul des bulletins. Ne bloque pas la validation fiche
 * si Redis est down (retourne ok: false).
 */
export async function enqueueGenerateGrades(periodId: number): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    await ensureRedisReady();
    await getGradeQueue().add(
      "generate-grades",
      { periodId },
      {
        jobId: `period-${periodId}`,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "File Redis indisponible.";
    // Un job déjà en file pour cette période = OK.
    if (/already (exists|been added)/i.test(message)) {
      return { ok: true };
    }
    console.warn("[gradeQueue] enqueue failed:", message);
    return { ok: false, error: message };
  }
}
