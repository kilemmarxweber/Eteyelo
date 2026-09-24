import "server-only";

/**
 * File WhatsApp process-wide : un message après l’autre, rythme « humain ».
 *
 * Objectifs :
 * - ne jamais bombarder (plancher anti-Guardian / TVS ~14 s)
 * - éviter un métronome (jitter asymétrique, dérive, pauses irrégulières)
 * - ralentir naturellement sur les gros lots et après un rate-limit
 */

/** Écart de base (TVS = 14 s). Surcharge : WHATSAPP_SEND_GAP_MS */
export const WHATSAPP_SEND_GAP_MS = readEnvMs(
  "WHATSAPP_SEND_GAP_MS",
  14_000,
);

const MIN_GAP_MS = 3_500;
const MAX_GAP_MS = 90_000;
const MAX_GUARDIAN_RETRIES = 5;

/** Si aucun envoi depuis si longtemps → nouvelle « session » (warm-up). */
const SESSION_IDLE_MS = 3 * 60_000;

/** Après un rate-limit, gap élevé pendant… */
const ELEVATED_HOLD_MS = 2 * 60_000;
const ELEVATED_GAP_MULTIPLIER = 1.75;

let chain: Promise<void> = Promise.resolve();
let lastSendAt = 0;
let consecutiveOk = 0;
let elevatedUntil = 0;
let elevatedGapMs = 0;

/**
 * Pace « d’humeur » (facteur ~0.85–1.35) qui dérive doucement :
 * deux écarts successifs se ressemblent un peu, sans être identiques.
 */
let moodFactor = 1;
/** Compteur depuis la dernière vraie pause « café ». */
let sinceHumanBreak = 0;

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

/** Uniforme [0, 1). */
function rand() {
  return Math.random();
}

/** Entier inclusif. */
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/**
 * Bruit gaussien approximatif (Box–Muller).
 * Les humains s’écartent surtout un peu du rythme, rarement beaucoup.
 */
function gaussianNoise(sigma = 1) {
  const u = Math.max(1e-9, rand());
  const v = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
}

/** Jitter asymétrique : un peu plus souvent un peu plus lent que plus rapide. */
function humanJitter(baseMs: number): number {
  // sigma ~ 18 % du base ; biais +6 % (légère tendance à traîner)
  const noisy = baseMs * (1.06 + gaussianNoise(0.18));
  // micro-irrégularité (évite les .000 / multiples ronds)
  const crumbs = randInt(47, 891);
  return Math.round(clamp(noisy + crumbs, MIN_GAP_MS, MAX_GAP_MS));
}

function driftMood() {
  // Marche aléatoire amortie vers 1.0
  moodFactor += gaussianNoise(0.04);
  moodFactor = clamp(moodFactor * 0.92 + 0.08 * 1, 0.82, 1.38);
}

function warmUpExtraMs(): number {
  // Premiers messages d’une session : un peu plus prudents
  if (consecutiveOk === 0) return randInt(1_200, 4_800);
  if (consecutiveOk === 1) return randInt(400, 2_200);
  if (consecutiveOk === 2) return randInt(0, 1_100);
  return 0;
}

function fatigueExtraMs(okCount: number): number {
  // Montée douce, non linéaire (pas +X toutes les N piles)
  if (okCount < 4) return 0;
  const t = okCount - 3;
  const soft = Math.sqrt(t) * 2_800 + t * 900;
  // Petite variation pour ne pas plafonner toujours au même ms
  return Math.round(clamp(soft + gaussianNoise(400), 0, 28_000));
}

/**
 * Pause « humaine » occasionnelle : comme si on regardait l’écran,
 * répondait à quelqu’un, ou changeait de destinataire.
 */
function maybeHumanBreakMs(): number {
  sinceHumanBreak += 1;

  // Plus le lot avance, plus une pause devient probable
  const pressure = Math.min(0.55, 0.08 + sinceHumanBreak * 0.035);
  if (rand() > pressure) return 0;

  sinceHumanBreak = 0;

  // Trois styles de pause (weights)
  const roll = rand();
  if (roll < 0.55) {
    // micro-hésitation
    return randInt(2_500, 7_500);
  }
  if (roll < 0.88) {
    // pause moyenne (relire / chercher un numéro)
    return randInt(8_000, 22_000);
  }
  // vraie coupure (rare)
  return randInt(25_000, 55_000);
}

function currentBaseGapMs(): number {
  const now = Date.now();
  if (now < elevatedUntil && elevatedGapMs > 0) {
    return Math.max(WHATSAPP_SEND_GAP_MS, elevatedGapMs);
  }
  return WHATSAPP_SEND_GAP_MS;
}

function refreshSessionIfIdle() {
  if (lastSendAt > 0 && Date.now() - lastSendAt > SESSION_IDLE_MS) {
    consecutiveOk = 0;
    sinceHumanBreak = 0;
    moodFactor = 0.95 + rand() * 0.2;
  }
}

/**
 * Calcule l’écart avant le prochain envoi :
 * base × humeur + fatigue + warm-up + pause humaine + jitter.
 */
export function nextWhatsAppGapMs(): number {
  refreshSessionIfIdle();
  driftMood();

  const base =
    currentBaseGapMs() * moodFactor +
    fatigueExtraMs(consecutiveOk) +
    warmUpExtraMs() +
    maybeHumanBreakMs();

  return humanJitter(base);
}

/**
 * Micro-délai juste avant l’appel API (« doigt sur Envoyer »).
 * Cassure le pattern wait→send→wait→send parfaitement cadencé.
 */
function preSendHesitationMs(): number {
  const roll = rand();
  if (roll < 0.15) return 0;
  if (roll < 0.7) return randInt(180, 900);
  if (roll < 0.92) return randInt(900, 2_200);
  return randInt(2_200, 4_500);
}

export function estimateWhatsAppBatchDurationMs(count: number): number {
  if (count <= 1) return 0;
  // Moyenne approximative (sans pauses rares extrêmes)
  const avg = currentBaseGapMs() * 1.15 + 3_500;
  return Math.round(avg * (count - 1));
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
      return humanJitter((sec + 1.2) * 1000);
    }
  }

  if (
    /Guardian|anti-ban|RATE_LIMIT|rate.?limit|too many|pace WhatsApp|429/i.test(
      message,
    )
  ) {
    return humanJitter(
      Math.max(WHATSAPP_SEND_GAP_MS, currentBaseGapMs()) * 1.35,
    );
  }

  return null;
}

function noteRateLimitHit(waitMs: number) {
  consecutiveOk = 0;
  sinceHumanBreak = 0;
  moodFactor = clamp(moodFactor + 0.15, 1.05, 1.38);
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
  if (Date.now() >= elevatedUntil) {
    elevatedGapMs = 0;
  }
}

/**
 * File unique : chaque message attend la fin du précédent + un écart humain.
 */
export function enqueueWhatsAppTask<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    refreshSessionIfIdle();

    const gap = nextWhatsAppGapMs();
    const wait = lastSendAt > 0 ? lastSendAt + gap - Date.now() : 0;
    if (wait > 0) await sleepMs(wait);

    // Hesitation juste avant l’envoi (après le gros écart)
    const hesitate = preSendHesitationMs();
    if (hesitate > 0) await sleepMs(hesitate);

    try {
      const result = await task();
      noteSuccessfulSend();
      return result;
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
      const backoff = waitMs * Math.pow(1.4, attempt) + randInt(400, 2_500);
      await sleepMs(clamp(Math.round(backoff), MIN_GAP_MS, MAX_GAP_MS));
    }
  }

  throw lastError;
}

/** Réservé aux tests / debug. */
export function __resetWhatsAppPaceForTests() {
  chain = Promise.resolve();
  lastSendAt = 0;
  consecutiveOk = 0;
  elevatedUntil = 0;
  elevatedGapMs = 0;
  moodFactor = 1;
  sinceHumanBreak = 0;
}
