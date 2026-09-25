import "server-only";

/**
 * File WhatsApp process-wide — un message après l’autre.
 *
 * Profil `qr` (GOWA / Zindua / Klambo QR) : très prudent (lots ~50+).
 * Profil `cloud` (Meta Cloud API) : plus rapide, templates officiels.
 *
 * Les chats sortants apparaissent toujours sur le téléphone scanné (sync
 * multi-appareils WhatsApp) — ce n’est pas une « copie » API, c’est normal.
 */

export type WhatsAppPaceProfile = "qr" | "cloud";

type ProfileConfig = {
  baseGapMs: number;
  minGapMs: number;
  maxGapMs: number;
  /** Pause longue tous les N envois réussis. */
  chunkEvery: number;
  chunkBreakMinMs: number;
  chunkBreakMaxMs: number;
  /** Au-delà : écarts nettement plus longs. */
  softCap: number;
  /** Au-delà : pause forcée longue avant de continuer. */
  hardCap: number;
  hardBreakMinMs: number;
  hardBreakMaxMs: number;
};

const PROFILES: Record<WhatsAppPaceProfile, ProfileConfig> = {
  // ~30–45 s entre msgs + pause 3–6 min tous les 8 + pause longue vers 45+
  qr: {
    baseGapMs: readEnvMs("WHATSAPP_SEND_GAP_MS", 32_000, 12_000),
    minGapMs: 12_000,
    maxGapMs: 12 * 60_000,
    chunkEvery: 8,
    chunkBreakMinMs: 3 * 60_000,
    chunkBreakMaxMs: 6 * 60_000,
    softCap: 32,
    hardCap: 48,
    hardBreakMinMs: 8 * 60_000,
    hardBreakMaxMs: 14 * 60_000,
  },
  cloud: {
    baseGapMs: readEnvMs("WHATSAPP_SEND_GAP_MS", 8_000, 3_500),
    minGapMs: 3_500,
    maxGapMs: 90_000,
    chunkEvery: 20,
    chunkBreakMinMs: 20_000,
    chunkBreakMaxMs: 45_000,
    softCap: 80,
    hardCap: 150,
    hardBreakMinMs: 60_000,
    hardBreakMaxMs: 120_000,
  },
};

const MAX_GUARDIAN_RETRIES = 4;
const SESSION_IDLE_MS = 8 * 60_000;
/** Après restriction détectée : refuser / attendre longtemps. */
const CIRCUIT_HOLD_MS = 20 * 60_000;

let profile: WhatsAppPaceProfile = "qr";
let chain: Promise<void> = Promise.resolve();
let lastSendAt = 0;
let consecutiveOk = 0;
let elevatedUntil = 0;
let elevatedGapMs = 0;
let moodFactor = 1;
let sinceHumanBreak = 0;
let sinceChunk = 0;
let circuitOpenUntil = 0;

function readEnvMs(name: string, fallback: number, minFloor: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < minFloor) return fallback;
  return Math.round(n);
}

function cfg(): ProfileConfig {
  return PROFILES[profile];
}

export function setWhatsAppPaceProfile(next: WhatsAppPaceProfile) {
  profile = next;
}

export function getWhatsAppPaceProfile(): WhatsAppPaceProfile {
  return profile;
}

/** true si WhatsApp a récemment restreint — les lots doivent s’arrêter. */
export function isWhatsAppCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

export function getWhatsAppCircuitRemainingMs(): number {
  return Math.max(0, circuitOpenUntil - Date.now());
}

export function sleepMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function rand() {
  return Math.random();
}

function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function gaussianNoise(sigma = 1) {
  const u = Math.max(1e-9, rand());
  const v = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
}

function humanJitter(baseMs: number): number {
  const { minGapMs, maxGapMs } = cfg();
  const noisy = baseMs * (1.08 + gaussianNoise(0.2));
  const crumbs = randInt(73, 1_247);
  return Math.round(clamp(noisy + crumbs, minGapMs, maxGapMs));
}

function driftMood() {
  moodFactor += gaussianNoise(0.045);
  moodFactor = clamp(moodFactor * 0.9 + 0.1 * 1, 0.88, 1.45);
}

function warmUpExtraMs(): number {
  if (consecutiveOk === 0) return randInt(2_000, 8_000);
  if (consecutiveOk === 1) return randInt(800, 4_000);
  if (consecutiveOk === 2) return randInt(0, 2_000);
  return 0;
}

function fatigueExtraMs(okCount: number): number {
  const { softCap } = cfg();
  if (okCount < 5) return 0;
  const t = okCount - 4;
  let soft = Math.sqrt(t) * 3_500 + t * 1_200;
  if (okCount >= softCap) {
    soft += (okCount - softCap + 1) * 4_500;
  }
  return Math.round(clamp(soft + gaussianNoise(600), 0, 90_000));
}

function maybeHumanBreakMs(): number {
  sinceHumanBreak += 1;
  const pressure = Math.min(0.5, 0.06 + sinceHumanBreak * 0.028);
  if (rand() > pressure) return 0;

  sinceHumanBreak = 0;
  const roll = rand();
  if (roll < 0.5) return randInt(3_000, 9_000);
  if (roll < 0.85) return randInt(12_000, 35_000);
  return randInt(40_000, 90_000);
}

/** Pause structurée tous les N messages (anti-rafale WhatsApp). */
function maybeChunkBreakMs(): number {
  const { chunkEvery, chunkBreakMinMs, chunkBreakMaxMs } = cfg();
  sinceChunk += 1;
  if (sinceChunk < chunkEvery) return 0;
  sinceChunk = 0;
  return randInt(chunkBreakMinMs, chunkBreakMaxMs);
}

/** Pause longue après un gros volume dans la session. */
function maybeHardBreakMs(): number {
  const { hardCap, hardBreakMinMs, hardBreakMaxMs } = cfg();
  if (consecutiveOk === 0 || consecutiveOk % hardCap !== 0) return 0;
  return randInt(hardBreakMinMs, hardBreakMaxMs);
}

function currentBaseGapMs(): number {
  const now = Date.now();
  const base = cfg().baseGapMs;
  if (now < elevatedUntil && elevatedGapMs > 0) {
    return Math.max(base, elevatedGapMs);
  }
  return base;
}

function refreshSessionIfIdle() {
  if (lastSendAt > 0 && Date.now() - lastSendAt > SESSION_IDLE_MS) {
    consecutiveOk = 0;
    sinceHumanBreak = 0;
    sinceChunk = 0;
    moodFactor = 0.95 + rand() * 0.2;
  }
}

export function nextWhatsAppGapMs(): number {
  refreshSessionIfIdle();
  driftMood();

  const base =
    currentBaseGapMs() * moodFactor +
    fatigueExtraMs(consecutiveOk) +
    warmUpExtraMs() +
    maybeHumanBreakMs() +
    maybeChunkBreakMs() +
    maybeHardBreakMs();

  return humanJitter(base);
}

function preSendHesitationMs(): number {
  const roll = rand();
  if (roll < 0.12) return 0;
  if (roll < 0.65) return randInt(250, 1_200);
  if (roll < 0.9) return randInt(1_200, 3_000);
  return randInt(3_000, 6_500);
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
      return humanJitter((sec + 2) * 1000);
    }
  }

  if (
    /Guardian|anti-ban|RATE_LIMIT|rate.?limit|too many|pace WhatsApp|429|restrict|bloqu|spam|temporarily banned|connexion.*limit/i.test(
      message,
    )
  ) {
    return humanJitter(
      Math.max(cfg().baseGapMs, currentBaseGapMs()) * 2.2,
    );
  }

  return null;
}

function openCircuit(reasonMs?: number) {
  const hold = Math.max(reasonMs ?? 0, CIRCUIT_HOLD_MS);
  circuitOpenUntil = Date.now() + hold;
  consecutiveOk = 0;
  sinceChunk = 0;
  sinceHumanBreak = 0;
  moodFactor = 1.25;
  elevatedGapMs = cfg().baseGapMs * 2.5;
  elevatedUntil = circuitOpenUntil;
}

function noteRateLimitHit(waitMs: number) {
  consecutiveOk = 0;
  sinceHumanBreak = 0;
  sinceChunk = 0;
  moodFactor = clamp(moodFactor + 0.2, 1.1, 1.45);
  elevatedGapMs = Math.round(
    Math.max(waitMs, cfg().baseGapMs * 2, currentBaseGapMs() * 2),
  );
  elevatedUntil = Date.now() + Math.max(waitMs * 3, 5 * 60_000);
}

function noteSuccessfulSend() {
  consecutiveOk += 1;
  if (Date.now() >= elevatedUntil) {
    elevatedGapMs = 0;
  }
}

/**
 * File unique : sérialise tous les envois du process.
 * Attend le circuit, le gap humain, puis une micro-hésitation.
 */
export function enqueueWhatsAppTask<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    refreshSessionIfIdle();

    // Circuit ouvert : attendre la fin (évite d’aggraver un ban)
    const circuitWait = getWhatsAppCircuitRemainingMs();
    if (circuitWait > 0) {
      await sleepMs(circuitWait);
    }

    const gap = nextWhatsAppGapMs();
    const wait = lastSendAt > 0 ? lastSendAt + gap - Date.now() : 0;
    if (wait > 0) await sleepMs(wait);

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
        if (waitMs != null) {
          // Restriction confirmée : coupe-circuit, on arrête de marteler
          openCircuit(Math.max(waitMs * 5, CIRCUIT_HOLD_MS));
        }
        throw error;
      }

      noteRateLimitHit(waitMs);
      const backoff =
        waitMs * Math.pow(1.5, attempt) + randInt(1_000, 5_000);
      await sleepMs(
        clamp(Math.round(backoff), cfg().minGapMs, cfg().maxGapMs),
      );
    }
  }

  throw lastError;
}

export function estimateWhatsAppBatchDurationMs(count: number): number {
  if (count <= 1) return 0;
  const c = cfg();
  const avgGap = c.baseGapMs * 1.25;
  const chunks = Math.floor((count - 1) / c.chunkEvery);
  const chunkAvg = (c.chunkBreakMinMs + c.chunkBreakMaxMs) / 2;
  return Math.round(avgGap * (count - 1) + chunks * chunkAvg);
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
  sinceChunk = 0;
  circuitOpenUntil = 0;
  profile = "qr";
}
