/**
 * Coupe SMTP dès que Zoho/l'hébergeur refuse l'envoi, pour éviter
 * la boucle BullMQ → AUTH → 554/450 qui aggrave le blocage.
 */

const OUTBOUND_DISABLED_RE =
  /554\s*5\.7\.1|outbound sending is disabled|envoi d['’]emails a été temporairement suspendu/i;
const TOO_MANY_AUTH_RE = /too many AUTH|450\s*4\.7\.1/i;

const OUTBOUND_DISABLED_MS = 12 * 60 * 60 * 1000;
const TOO_MANY_AUTH_MS = 30 * 60 * 1000;
const SKIP_LOG_INTERVAL_MS = 60_000;

let suspendedUntil = 0;
let lastSkipLogAt = 0;
let lastReason = "";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isSmtpOutboundSuspended(): boolean {
  if (process.env.SMTP_SUSPENDED === "true") return true;
  return Date.now() < suspendedUntil;
}

export function suspendSmtpOutbound(reason: string, ms: number): void {
  const until = Date.now() + ms;
  if (until <= suspendedUntil && lastReason === reason) return;
  suspendedUntil = Math.max(suspendedUntil, until);
  lastReason = reason;
  const minutes = Math.max(1, Math.round(ms / 60_000));
  // eslint-disable-next-line no-console
  console.warn(
    `[smtp] envoi suspendu ~${minutes} min — ${reason}. Réactivez le compte chez l'hébergeur, puis redémarrez le worker (ou SMTP_SUSPENDED=false).`,
  );
}

export function classifySmtpError(
  err: unknown,
): "outbound-disabled" | "too-many-auth" | "other" {
  const msg = errorMessage(err);
  if (OUTBOUND_DISABLED_RE.test(msg)) return "outbound-disabled";
  if (TOO_MANY_AUTH_RE.test(msg)) return "too-many-auth";
  return "other";
}

/** True si l'erreur est définitive / doit stopper SMTP (ne pas retry). */
export function applySmtpFailure(err: unknown): boolean {
  const kind = classifySmtpError(err);
  if (kind === "outbound-disabled") {
    suspendSmtpOutbound(errorMessage(err), OUTBOUND_DISABLED_MS);
    return true;
  }
  if (kind === "too-many-auth") {
    suspendSmtpOutbound(errorMessage(err), TOO_MANY_AUTH_MS);
    return true;
  }
  return false;
}

export function logSmtpSkip(to: string, subject: string): void {
  const now = Date.now();
  if (now - lastSkipLogAt < SKIP_LOG_INTERVAL_MS) return;
  lastSkipLogAt = now;
  // eslint-disable-next-line no-console
  console.warn(
    `[smtp] skip (envoi suspendu) to=${to} subject=${subject} — les jobs suivants sont ignorés sans AUTH`,
  );
}
