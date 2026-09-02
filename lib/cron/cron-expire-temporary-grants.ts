import { expireOutdatedGrants } from "@/lib/auth/temporary-privilege";

/**
 * Tâche récurrente (Cron Job / Background Worker) pour la péremption automatique
 * des privilèges temporaires.
 */
export async function runExpireTemporaryGrantsCron() {
  try {
    const result = await expireOutdatedGrants();
    console.log(
      `[CRON] Péremption automatique des privilèges temporaires : ${result.count} privilèges marqués EXPIRED.`
    );
    return { ok: true, count: result.count };
  } catch (error) {
    console.error("[CRON] Erreur lors de la péremption des privilèges temporaires:", error);
    return { ok: false, error };
  }
}
