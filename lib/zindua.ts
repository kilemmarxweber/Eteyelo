import { Zindua, type ZinduaSendResult } from "@zindua/sdk";

/** Destinataire WhatsApp de test (dev). Ne pas utiliser pour les notifs parents/élèves. */
export const DEFAULT_WHATSAPP_TO = "+243971651881";

/** Template Zindua (dashboard) — variables: appName, name, code. */
export const ZINDUA_MAIL_MIRROR_TEMPLATE =
  process.env.ZINDUA_WHATSAPP_MAIL_TEMPLATE?.trim() || "notification";

const APP_NAME = process.env.APP_NAME?.trim() || "Klambocore";
const WHATSAPP_CODE_MAX = 3500;

/** Zindua refuse les caractères de contrôle (\\n, \\t, …) dans les variables. */
function sanitizeWhatsAppVariable(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\r\n\t]+/g, " | ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/( \| ){2,}/g, " | ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function truncateWhatsAppCode(value: string): string {
  const cleaned = sanitizeWhatsAppVariable(value);
  if (cleaned.length <= WHATSAPP_CODE_MAX) return cleaned;
  return `${cleaned.slice(0, WHATSAPP_CODE_MAX - 1)}…`;
}

function getApiKey(): string | null {
  return process.env.ZINDUA_API_KEY?.trim() || null;
}

function getSiteUrl(): string | undefined {
  return (
    process.env.ZINDUA_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    undefined
  );
}

export function isZinduaConfigured(): boolean {
  return Boolean(getApiKey());
}

let client: Zindua | null = null;

/** Client Zindua (serveur uniquement). */
export function getZindua(): Zindua {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("ZINDUA_API_KEY manquante dans l'environnement.");
  }
  if (!client) {
    client = new Zindua({
      apiKey,
      siteUrl: getSiteUrl(),
    });
  }
  return client;
}

/**
 * Normalise vers E.164.
 * Gère les formats RDC courants : 0844…, 844…, 243844…, +243844…
 */
export function toE164Phone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    throw new Error("Numéro WhatsApp vide.");
  }

  let digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    throw new Error("Numéro WhatsApp invalide.");
  }

  // 0XXXXXXXXX (10 chiffres locaux RDC)
  if (digits.startsWith("0") && digits.length === 10) {
    digits = `243${digits.slice(1)}`;
  }
  // 9 chiffres mobiles RDC (ex. 844952966)
  else if (digits.length === 9 && /^[89]/.test(digits)) {
    digits = `243${digits}`;
  }

  if (digits.length < 10) {
    throw new Error("Numéro WhatsApp trop court.");
  }

  return `+${digits}`;
}

/** Numéro utilisable pour WhatsApp (ignore placeholders type +243000000000). */
export function resolveWhatsAppTo(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  try {
    const e164 = toE164Phone(phone);
    const digits = e164.replace(/\D/g, "");
    if (digits.length < 11) return null;
    // Placeholder fréquent à la création élève / centre
    if (/^2430+$/.test(digits) || /^0+$/.test(digits)) return null;
    return e164;
  } catch {
    return null;
  }
}

type SendWhatsAppOptions = {
  /** Destinataire E.164. Défaut : DEFAULT_WHATSAPP_TO (test). */
  to?: string;
  /** Slug du template Zindua (dashboard). */
  template?: string;
  /** Variables du template notification : appName, name, code. */
  variables?: {
    appName?: string;
    name?: string;
    code?: string;
    [key: string]: string | undefined;
  };
  /** Langue optionnelle (`fr`, `en`, …). */
  lang?: string;
};

/**
 * Envoie un message WhatsApp via Zindua (template).
 */
export async function sendWhatsApp(
  options: SendWhatsAppOptions,
): Promise<ZinduaSendResult> {
  const template = options.template ?? ZINDUA_MAIL_MIRROR_TEMPLATE;
  const to = toE164Phone(options.to ?? DEFAULT_WHATSAPP_TO);
  const raw = options.variables ?? {};
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value != null && value !== "") variables[key] = value;
  }

  return getZindua().send({
    to,
    channel: "whatsapp",
    template,
    lang: options.lang ?? "fr",
    variables,
  });
}

type MirrorEmailOptions = {
  to: string;
  subject: string;
  body: string;
  /** Prénom/nom pour {{name}} du template. */
  name?: string | null;
  lang?: string;
};

/**
 * Miroir email → WhatsApp via le template `notification`
 * (variables dashboard : {{appName}}, {{name}}, {{code}}).
 */
export async function mirrorEmailToWhatsApp(
  options: MirrorEmailOptions,
): Promise<ZinduaSendResult | null> {
  if (!isZinduaConfigured()) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[mirrorEmailToWhatsApp] Zindua off — skip to=${options.to} subject=${options.subject}`,
      );
    }
    return null;
  }

  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn(
      `[mirrorEmailToWhatsApp] numéro invalide (« ${options.to} »), skip subject=${options.subject}`,
    );
    return null;
  }

  // Le template n’accepte que {{code}} (sans \\n — Zindua refuse les control chars).
  const code = truncateWhatsAppCode(
    `${options.subject.trim()} | ${options.body.trim()}`,
  );

  try {
    const result = await sendWhatsApp({
      to,
      template: ZINDUA_MAIL_MIRROR_TEMPLATE,
      lang: options.lang ?? "fr",
      variables: {
        code,
      },
    });
    // eslint-disable-next-line no-console
    console.info(
      `[mirrorEmailToWhatsApp] ok to=${to} logId=${result.logId} status=${result.status}`,
    );
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[mirrorEmailToWhatsApp] échec:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

type ResetPasswordWhatsAppOptions = {
  to: string;
  name: string;
  temporaryPassword: string;
  email: string;
  loginUrl?: string;
  /** Nom d'établissement affiché en tête du message (ex. CS MARGUERITE). */
  branchName?: string | null;
};

function resolveWhatsAppLoginUrl(loginUrl?: string | null): string {
  const raw =
    loginUrl?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://klambocore.com";
  // Évite …/auth/sign-in/auth/sign-in si loginUrl est déjà complet
  if (/\/auth\/sign-in\/?$/i.test(raw)) return raw.replace(/\/$/, "");
  return `${raw.replace(/\/$/, "")}/auth/sign-in`;
}

function buildWhatsAppBody(parts: Array<string | null | undefined>): string {
  return truncateWhatsAppCode(
    parts
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join(" | "),
  );
}

/**
 * WhatsApp compte créé (parent/élève/…) — message complet dans {{code}}.
 */
export async function sendNewUserCredentialsWhatsApp(options: {
  to: string;
  name: string;
  email: string;
  temporaryPassword: string;
  role?: string;
  organizationName?: string;
  branchName?: string | null;
  loginUrl?: string;
}): Promise<ZinduaSendResult | null> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sendNewUserCredentialsWhatsApp] numéro invalide (« ${options.to} »)`,
    );
    return null;
  }
  if (!isZinduaConfigured()) return null;

  const loginUrl = resolveWhatsAppLoginUrl(options.loginUrl);
  const displayName = options.name.trim() || "Parent";
  const role = options.role?.trim() || "Utilisateur";
  const branchLabel = options.branchName?.trim() || null;

  const message = buildWhatsAppBody([
    branchLabel,
    `Bonjour ${displayName},`,
    `votre compte ${APP_NAME} a été créé (rôle ${role}).`,
    `Email : ${options.email}.`,
    `Mot de passe temporaire : ${options.temporaryPassword}.`,
    `Connectez-vous : ${loginUrl}`,
    "Changez ce mot de passe après connexion. Ne le partagez avec personne.",
    `— ${branchLabel || APP_NAME}`,
  ]);

  try {
    const result = await sendWhatsApp({
      to,
      template: ZINDUA_MAIL_MIRROR_TEMPLATE,
      lang: "fr",
      variables: {
        code: message,
      },
    });
    // eslint-disable-next-line no-console
    console.info(
      `[sendNewUserCredentialsWhatsApp] ok to=${to} logId=${result.logId} status=${result.status}`,
    );
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendNewUserCredentialsWhatsApp] échec:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * WhatsApp réinit MDP — message complet dans {{code}}.
 */
export async function sendResetPasswordWhatsApp(
  options: ResetPasswordWhatsAppOptions,
): Promise<ZinduaSendResult | null> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sendResetPasswordWhatsApp] numéro invalide (« ${options.to} »)`,
    );
    return null;
  }
  if (!isZinduaConfigured()) return null;

  const loginUrl = resolveWhatsAppLoginUrl(options.loginUrl);
  const displayName = options.name.trim() || "Parent";
  const branchLabel = options.branchName?.trim() || null;

  const message = buildWhatsAppBody([
    branchLabel,
    `Bonjour ${displayName},`,
    `votre mot de passe ${APP_NAME} a été réinitialisé.`,
    `Email : ${options.email}.`,
    `Mot de passe temporaire : ${options.temporaryPassword}.`,
    `Connectez-vous : ${loginUrl}`,
    "Changez-le après connexion. Ne le partagez avec personne.",
    `— ${branchLabel || APP_NAME}`,
  ]);

  try {
    const result = await sendWhatsApp({
      to,
      template: ZINDUA_MAIL_MIRROR_TEMPLATE,
      lang: "fr",
      variables: {
        code: message,
      },
    });
    // eslint-disable-next-line no-console
    console.info(
      `[sendResetPasswordWhatsApp] ok to=${to} logId=${result.logId} status=${result.status}`,
    );
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sendResetPasswordWhatsApp] échec:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
