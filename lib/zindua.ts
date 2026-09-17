import { Zindua, type ZinduaSendResult } from "@zindua/sdk";
import { MessagingClient } from "@/lib/messaging-client";
import {
  getWhatsAppRuntimeConfig,
  isEnvWhatsAppEnabled,
  providerLabel,
  usesMessagingApi,
  type WhatsAppProviderId,
} from "@/lib/whatsapp-settings";
import {
  enqueueWhatsAppTask,
  withWhatsAppGuardianRetry,
} from "@/lib/whatsapp-pace";

export type WhatsAppSendOutcome = {
  sent: boolean;
  error?: string;
};

export type WhatsAppSendResult = {
  success: boolean;
  logId?: string;
  status?: string;
};

export type ZinduaWhatsAppChannelStatus = {
  sendingEnabled: boolean;
  envEnabled: boolean;
  connected: boolean;
  status: string | null;
  setupUrl: string | null;
  projectName: string | null;
  provider?: WhatsAppProviderId;
  error?: string;
};

export function formatZinduaError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code ?? "");
    if (code === "WHATSAPP_NOT_CONNECTED") {
      return "WhatsApp n'est pas connecté — ouvrez le dashboard et scannez le QR.";
    }
    if (
      "message" in error &&
      typeof (error as { message: unknown }).message === "string" &&
      (error as { message: string }).message.trim()
    ) {
      return (error as { message: string }).message;
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Échec d'envoi WhatsApp.";
}

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

function getApiKey(override?: string | null): string | null {
  return override?.trim() || process.env.ZINDUA_API_KEY?.trim() || null;
}

function getSiteUrl(override?: string | null): string | undefined {
  const fromOverride = override?.replace(/\/$/, "").trim();
  if (fromOverride) return fromOverride;
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

/** Client Zindua (serveur uniquement). Recréé si l'URL site / la clé change. */
export function getZindua(options?: {
  siteUrl?: string | null;
  apiKey?: string | null;
}): Zindua {
  const apiKey = getApiKey(options?.apiKey);
  if (!apiKey) {
    throw new Error("Clé API Zindua manquante (Paramètres WhatsApp ou ZINDUA_API_KEY).");
  }
  return new Zindua({
    apiKey,
    siteUrl: getSiteUrl(options?.siteUrl),
  });
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
  /** Organisation (toggle + template + URL). */
  organizationId?: string | null;
  /** Ignore le toggle (test d'envoi depuis les paramètres). */
  force?: boolean;
  /** Pièces jointes : email seulement. Un seul /send WhatsApp (file + pacing). */
  attachments?: Array<{ url: string; filename?: string }>;
};

/**
 * Envoie un message WhatsApp via le provider actif (Zindua | Klambo | Meta).
 * Retourne null si l'envoi est désactivé (fournisseur / paramètres org).
 */
export async function sendWhatsApp(
  options: SendWhatsAppOptions,
): Promise<WhatsAppSendResult | null> {
  const config = await getWhatsAppRuntimeConfig(options.organizationId);
  if (!config.enabled && !options.force) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[sendWhatsApp] skip (WhatsApp désactivé) to=${options.to ?? ""}`,
      );
    }
    return null;
  }

  if (!config.apiKey) {
    throw new Error(
      `Clé API manquante pour ${providerLabel(config.provider)} (Paramètres WhatsApp ou .env).`,
    );
  }

  const template =
    options.template ?? config.template ?? ZINDUA_MAIL_MIRROR_TEMPLATE;
  const to = toE164Phone(options.to ?? DEFAULT_WHATSAPP_TO);
  const raw = options.variables ?? {};
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value != null && value !== "") {
      variables[key] =
        key === "code" ? truncateWhatsAppCode(value) : sanitizeWhatsAppVariable(value);
    }
  }

  return enqueueWhatsAppTask(() =>
    withWhatsAppGuardianRetry(async () => {
      if (usesMessagingApi(config.provider)) {
        const client = new MessagingClient({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
        });
        const res = await client.send({
          to,
          channel: "whatsapp",
          type: "template",
          template,
          lang: options.lang ?? "fr",
          variables,
        });
        return {
          success: res.success,
          logId: res.logId,
          status: res.status,
        };
      }

      const client = getZindua({
        siteUrl: config.siteUrl,
        apiKey: config.apiKey,
      });
      const res = (await client.send({
        to,
        channel: "whatsapp",
        template,
        lang: options.lang ?? "fr",
        variables,
      })) as ZinduaSendResult;
      return {
        success: Boolean(res.success),
        logId: res.logId,
        status: res.status,
      };
    }, formatZinduaError),
  );
}

type MirrorEmailOptions = {
  to: string;
  subject: string;
  body: string;
  /** Prénom/nom pour {{name}} du template. */
  name?: string | null;
  lang?: string;
  organizationId?: string | null;
};

/**
 * Miroir email → WhatsApp via le template `notification`
 * (variables dashboard : {{appName}}, {{name}}, {{code}}).
 */
export async function mirrorEmailToWhatsApp(
  options: MirrorEmailOptions,
): Promise<WhatsAppSendResult | null> {
  const config = await getWhatsAppRuntimeConfig(options.organizationId);
  if (!config.enabled) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info(
        `[mirrorEmailToWhatsApp] WhatsApp off — skip to=${options.to} subject=${options.subject}`,
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
      template: config.template,
      organizationId: options.organizationId,
      lang: options.lang ?? "fr",
      variables: {
        code,
      },
    });
    if (!result) return null;
    // eslint-disable-next-line no-console
    console.info(
      `[mirrorEmailToWhatsApp] ok to=${to} logId=${result.logId} status=${result.status}`,
    );
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[mirrorEmailToWhatsApp] échec:", formatZinduaError(error));
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
  organizationId?: string | null;
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

/** Message transactionnel (paiement, absence, résultats) dans {{code}}. */
export async function sendTransactionalWhatsApp(options: {
  to: string;
  organizationId?: string | null;
  parts: Array<string | null | undefined>;
  attachments?: Array<{ url: string; filename?: string }>;
}): Promise<WhatsAppSendOutcome> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    return { sent: false, error: "Numéro WhatsApp invalide." };
  }

  try {
    const result = await sendWhatsApp({
      to,
      organizationId: options.organizationId,
      lang: "fr",
      variables: {
        code: buildWhatsAppBody(options.parts),
      },
      attachments: options.attachments,
    });
    if (!result) {
      return {
        sent: false,
        error: "Envoi WhatsApp désactivé (paramètres ou .env).",
      };
    }
    return { sent: Boolean(result.success) };
  } catch (error) {
    const message = formatZinduaError(error);
    // eslint-disable-next-line no-console
    console.warn("[sendTransactionalWhatsApp] échec:", message);
    return { sent: false, error: message };
  }
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
  organizationId?: string | null;
}): Promise<WhatsAppSendOutcome> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sendNewUserCredentialsWhatsApp] numéro invalide (« ${options.to} »)`,
    );
    return { sent: false, error: "Numéro WhatsApp invalide." };
  }

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
      organizationId: options.organizationId,
      lang: "fr",
      variables: {
        code: message,
      },
    });
    if (!result) {
      return {
        sent: false,
        error: "Envoi WhatsApp désactivé (paramètres ou .env).",
      };
    }
    // eslint-disable-next-line no-console
    console.info(
      `[sendNewUserCredentialsWhatsApp] ok to=${to} logId=${result.logId} status=${result.status}`,
    );
    return { sent: Boolean(result.success) };
  } catch (error) {
    const message = formatZinduaError(error);
    // eslint-disable-next-line no-console
    console.warn("[sendNewUserCredentialsWhatsApp] échec:", message);
    return { sent: false, error: message };
  }
}

/**
 * WhatsApp réinit MDP — message complet dans {{code}}.
 */
export async function sendResetPasswordWhatsApp(
  options: ResetPasswordWhatsAppOptions,
): Promise<WhatsAppSendOutcome> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sendResetPasswordWhatsApp] numéro invalide (« ${options.to} »)`,
    );
    return { sent: false, error: "Numéro WhatsApp invalide." };
  }
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
      organizationId: options.organizationId,
      lang: "fr",
      variables: {
        code: message,
      },
    });
    if (!result) {
      return {
        sent: false,
        error: "Envoi WhatsApp désactivé (paramètres ou .env).",
      };
    }
    // eslint-disable-next-line no-console
    console.info(
      `[sendResetPasswordWhatsApp] ok to=${to} logId=${result.logId} status=${result.status}`,
    );
    return { sent: Boolean(result.success) };
  } catch (error) {
    const message = formatZinduaError(error);
    // eslint-disable-next-line no-console
    console.warn("[sendResetPasswordWhatsApp] échec:", message);
    return { sent: false, error: message };
  }
}

export async function getZinduaWhatsAppStatus(
  organizationId?: string | null,
): Promise<ZinduaWhatsAppChannelStatus> {
  const config = await getWhatsAppRuntimeConfig(organizationId);
  const base: ZinduaWhatsAppChannelStatus = {
    sendingEnabled: config.enabled,
    envEnabled: isEnvWhatsAppEnabled(),
    connected: false,
    status: null,
    setupUrl: null,
    projectName: null,
    provider: config.provider,
  };

  if (!config.apiKey) {
    return {
      ...base,
      error: `Clé API ${providerLabel(config.provider)} manquante.`,
    };
  }

  try {
    if (usesMessagingApi(config.provider)) {
      const client = new MessagingClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      });
      const project = await client.getProject();
      const isMeta =
        config.provider === "meta" ||
        project.whatsapp_provider === "meta";

      if (isMeta) {
        return {
          ...base,
          connected: true,
          status: "connected",
          setupUrl: config.baseUrl
            ? `${config.baseUrl.replace(/\/$/, "")}`
            : null,
          projectName: project.name
            ? `${project.name} · Meta Cloud`
            : "Meta Cloud API",
        };
      }

      const devices = await client.listDevices().catch(
        () => [] as Awaited<ReturnType<MessagingClient["listDevices"]>>,
      );
      const connected = devices.some((d) => d.status === "connected");
      const phone = devices.find((d) => d.phone)?.phone;
      return {
        ...base,
        connected,
        status: connected
          ? "connected"
          : devices[0]?.status ?? "disconnected",
        setupUrl: config.baseUrl
          ? `${config.baseUrl.replace(/\/$/, "")}`
          : null,
        projectName: phone
          ? `${project.name} · ${phone}`
          : (project.name ?? null),
      };
    }

    const project = (await getZindua({
      siteUrl: config.siteUrl,
      apiKey: config.apiKey,
    }).getProject()) as {
      project?: { name?: string };
      channels?: {
        whatsapp?: { ready?: boolean; status?: string; setupUrl?: string };
      };
      checklist?: { canSendWhatsapp?: boolean };
    };
    const channel = project.channels?.whatsapp;
    return {
      ...base,
      connected: Boolean(channel?.ready ?? project.checklist?.canSendWhatsapp),
      status: channel?.status ?? null,
      setupUrl: channel?.setupUrl ?? null,
      projectName: project.project?.name ?? null,
    };
  } catch (error) {
    return { ...base, error: formatZinduaError(error) };
  }
}

export async function sendWhatsAppTest(options: {
  to: string;
  organizationId?: string | null;
}): Promise<WhatsAppSendOutcome> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    return { sent: false, error: "Numéro WhatsApp invalide." };
  }

  const config = await getWhatsAppRuntimeConfig(options.organizationId);
  const label = providerLabel(config.provider);

  try {
    const result = await sendWhatsApp({
      to,
      organizationId: options.organizationId,
      force: true,
      lang: "fr",
      variables: {
        code: `Test Klambocore — vérification ${label}. Ignorez si vous n'êtes pas concerné.`,
      },
    });
    if (!result) {
      return { sent: false, error: "Envoi WhatsApp désactivé." };
    }
    return { sent: Boolean(result.success) };
  } catch (error) {
    return { sent: false, error: formatZinduaError(error) };
  }
}
