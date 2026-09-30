/**
 * Identité du compte anonyme « Notifications » (paiement, absence, MDP…).
 * Domaine réservé — jamais un utilisateur humain.
 */

export const SCHOOL_NOTIFY_BOT_EMAIL_PREFIX = "school-notify+";
export const SCHOOL_NOTIFY_BOT_EMAIL_DOMAIN = "system.klambo.local";

function emailLocalToken(id: string, max = 40) {
  return id.replace(/[^a-zA-Z0-9]/g, "").slice(0, max);
}

/** Compte anonyme org (legacy) ou branche : school-notify+…@system.klambo.local */
export function schoolNotifyBotEmail(
  organizationId: string,
  branchId?: string | null,
) {
  const orgLocal = emailLocalToken(organizationId, 40);
  const branchLocal = branchId?.trim()
    ? emailLocalToken(branchId.trim(), 40)
    : "";
  const local = branchLocal ? `${orgLocal}.${branchLocal}` : orgLocal;
  return `${SCHOOL_NOTIFY_BOT_EMAIL_PREFIX}${local}@${SCHOOL_NOTIFY_BOT_EMAIL_DOMAIN}`;
}

/** True pour les expéditeurs techniques des alertes (paiement, absence, MDP…). */
export function isSchoolNotifyBotEmail(email?: string | null): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized.startsWith(SCHOOL_NOTIFY_BOT_EMAIL_PREFIX) &&
    normalized.endsWith(`@${SCHOOL_NOTIFY_BOT_EMAIL_DOMAIN}`)
  );
}
