import "server-only";

/**
 * Paceur WhatsApp process-wide (Zindua Guardian / Klambo / GOWA).
 *
 * Inspiré de TVS (14 s fixes entre destinataires), avec :
 * - jitter aléatoire (évite le rythme robotique)
 * - fatigue progressive sur les gros lots
 * - cooldown adaptatif après rate-limit / Guardian
 * - file sérialisée unique pour tout le process Node
 */

/** Écart de base (TVS = 14 s). Surcharge possible via WHATSAPP_SEND_GAP_MS. */
export const WHATSAPP_SEND_GAP_MS = readEnvMs(
  "WHATSAPP_SEND_GAP_MS",
  14_000,
);

/** Plancher anti-ban (Guardian Zindua ≈ 3 s). */
const MIN_GAP_MS = 3_500;

/** Plafond d'un seul écart (cooldown inclus). */
const MAX_GAP_MS = 60_000;

/** ± ratio autour du gap effectif. */
const JITTER_RATIO = 0.28;

/** Tous les N envois réussis, on ajoute de la fatigue. */
const FATIGUE_EVERY = 6;
const FATIGUE_STEP_MS = 2_500;
const FATIGUE_CAP_MS = 20_000;

/** Après un rate-limit, on élève le gap pendant cette durée. */
const ELEVATED_HOLD_MS = 90_000;
const ELEVATED_GAP_MULTIPLIER = 1.6;

const MAX_GUARDIAN_RETRIES = 5;

let chain: Promise<void> = Promise.resolve();
let lastSendAt = 0;
let consecutiveOk = 0;
let elevatedUntil = 0;
let elevatedGapMs = 0;

function readEnvMs(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < MIN_GAP_MS) return fallback;
  return Math.min(Math.round(n), MAX_GAP_MS);
}

export function sleepMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Jitter uniforme dans ±ratio (jamais négatif une fois appliqué au gap). */
function withJitter(baseMs: number, ratio = JITTER_RATIO): number {
  const delta = baseMs * ratio;
  const jittered = baseMs + (Math.random() * 2 - 1) * delta;
  return Math.round(clamp(jittered, MIN_GAP_MS, MAX_GAP_MS));
}

function fatigueExtraMs(okCount: number): number {
  if (okCount < FATIGUE_EVERY) return 0;
  const steps = Math.floor(okCount / FATIGUE_EVERY);
  return Math.min(steps * FATIGUE_STEP_MS, FATIGUE_CAP_MS);
}

function currentBaseGapMs(): number {
  const now = Date.now();
  if (now < elevatedUntil && elevatedGapMs > 0) {
    return Math.max(WHATSAPP_SEND_GAP_MS, elevatedGapMs);
  }
  return WHATSAPP_SEND_GAP_MS;
}

/** Gap effectif avant le prochain envoi (sans attendre lastSendAt). */
export function nextWhatsAppGapMs(): number {
  const base = currentBaseGapMs() + fatigueExtraMs(consecutiveOk);
  return withJitter(base);
}

/**
 * Estime la durée d'un lot (moyenne, sans jitter extrême).
 * Utile pour messages UI du type « ~N min ».
 */
export function estimateWhatsAppBatchDurationMs(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 0;
  let total = 0;
  let ok = consecutiveOk;
  for (let i = 0; i < count - 1; i += 1) {
    total += currentBaseGapMs() + fatigueExtraMs(ok);
    ok += 1;
  }
  return total;
}

export function parseWhatsAppRetryWaitMs(
  message?: string | null,
): number | null {
  if (!message) return null;

  const waitSec =
    message.match(/Wait\s+(\d+(?:\.\d+)?)\s*s/i) ??
    message.match(/réessayez?\s+dans\s+(\d+(?:\.\d+)?)\s*s/i) ??
    message.match(/retry\s+after\s+(\d+(?:\.\d+)?)\s*s/i) ??
    message.match(/(\d+(?:\.\d+)?)\s*seconds?\s+(?:before|to)\s+retry/i);
  if (waitSec) {
    const sec = Number(waitSec[1]);
    if (Number.isFinite(sec) && sec > 0) {
      // +1 s de marge + léger jitter pour ne pas retenter pile au même tick
      return withJitter((sec + 1) * 1000, 0.15);
    }
  }

  if (
    /Guardian|anti-ban|RATE_LIMIT|rate.?limit|too many|pace WhatsApp|429/i.test(
      message,
    )
  ) {
    return withJitter(
      Math.max(WHATSAPP_SEND_GAP_MS, currentBaseGapMs()) * 1.25,
      0.2,
    );
  }

  return null;
}

function noteRateLimitHit(waitMs: number) {
  consecutiveOk = 0;
  elevatedGapMs = Math.round(
    Math.max(
      waitMs,
      WHATSAPP_SEND_GAP_MS * ELEVATED_GAP_MULTIPLIER,
      currentBaseGapMs() * ELEVATED_GAP_MULTIPLIER,
    ),
  );
  elevatedUntil = Date.now() + ELEVATED_HOLD_MS;
}

function noteSuccessfulSend() {
  consecutiveOk += 1;
  // Si la fenêtre élevée est finie, on laisse le gap redescendre naturellement
  if (Date.now() >= elevatedUntil) {
    elevatedGapMs = 0;
  }
}

/**
 * Une seule file WhatsApp pour tout le process Node.
 * Chaque tâche attend lastSendAt + gap (jitter / fatigue / cooldown).
 */
export function enqueueWhatsAppTask<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const gap = nextWhatsAppGapMs();
    const wait = lastSendAt + gap - Date.now();
    if (wait > 0) await sleepMs(wait);
    try {
      const result = await task();
      noteSuccessfulSend();
      return result;
    } catch (error) {
      // Les retries Guardian gèrent le cooldown ; ici on marque quand même
      // un échec « dur » pour ne pas accélérer le lot suivant.
      throw error;
    } finally {
      lastSendAt = Date.now();
    }
  };

  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * Relance sur erreurs Guardian / rate-limit avec backoff + respect du « Wait N s ».
 * Les autres erreurs remontent immédiatement.
 */
export async function withWhatsAppGuardianRetry<T>(
  task: () => Promise<T>,
  getErrorMessage: (error: unknown) => string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_GUARDIAN_RETRIES; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const message = getErrorMessage(error);
      const waitMs = parseWhatsAppRetryWaitMs(message);

      if (waitMs == null || attempt === MAX_GUARDIAN_RETRIES - 1) {
        throw error;
      }

      noteRateLimitHit(waitMs);
      // Backoff exponentiel léger en plus de la consigne provider
      const backoff = waitMs * Math.pow(1.35, attempt);
      await sleepMs(clamp(Math.round(backoff), MIN_GAP_MS, MAX_GAP_MS));
    }
  }

  throw lastError;
}

/** Réservé aux tests / debug — ne pas appeler en prod. */
export function __resetWhatsAppPaceForTests() {
  chain = Promise.resolve();
  lastSendAt = 0;
  consecutiveOk = 0;
  elevatedUntil = 0;
  elevatedGapMs = 0;
}
