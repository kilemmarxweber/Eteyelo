import "server-only";

/** Écart mini entre deux envois WhatsApp (Zindua Guardian / anti-ban = 3s). */
export const WHATSAPP_SEND_GAP_MS = 3500;
const MAX_GUARDIAN_RETRIES = 4;

let chain: Promise<void> = Promise.resolve();
let lastSendAt = 0;

export function sleepMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function parseWhatsAppRetryWaitMs(message?: string | null): number | null {
  if (!message) return null;
  const waitSec = message.match(/Wait\s+(\d+)\s*s/i);
  if (waitSec) {
    return (Number(waitSec[1]) + 1) * 1000;
  }
  if (/Guardian|anti-ban|RATE_LIMIT|pace WhatsApp/i.test(message)) {
    return WHATSAPP_SEND_GAP_MS;
  }
  return null;
}

/** Une seule file WhatsApp pour tout le process Node (évite le spam Guardian). */
export function enqueueWhatsAppTask<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = lastSendAt + WHATSAPP_SEND_GAP_MS - Date.now();
    if (wait > 0) await sleepMs(wait);
    try {
      return await task();
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
      const waitMs = parseWhatsAppRetryWaitMs(getErrorMessage(error));
      if (waitMs == null || attempt === MAX_GUARDIAN_RETRIES - 1) {
        throw error;
      }
      await sleepMs(waitMs);
    }
  }
  throw lastError;
}
