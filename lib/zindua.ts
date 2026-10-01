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
  type WhatsAppPaceProfile,
  type WhatsAppQueueKind,
} from "@/lib/whatsapp-pace";
import {
  formatMessagingHello,
  getMessagingTranslator,
  messagingLocaleToWhatsAppLang,
  resolveSenderMessagingLocale,
  type MessagingLocale,
} from "@/lib/messaging-locale";

export type WhatsAppSendOutcome = {
  sent: boolean;
  error?: string;
  /** Canal réellement utilisé (inbox Klambo ou gateway WhatsApp). */
  channel?: "klambo" | "whatsapp" | "none";
};

export type WhatsAppSendResult = {
  success: boolean;
  logId?: string;
  status?: string;
};

function outcomeFromSendResult(
  result: WhatsAppSendResult | null,
  disabledMessage = "Envoi WhatsApp désactivé (paramètres ou .env).",
): WhatsAppSendOutcome {
  if (!result) {
    return { sent: false, error: disabledMessage, channel: "none" };
  }
  if (!result.success) {
    return {
      sent: false,
      channel: "none",
      error: result.status
        ? `WhatsApp non délivré (${result.status}).`
        : "WhatsApp non délivré.",
    };
  }
  return { sent: true, channel: "whatsapp" };
}

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
  if (typeof error === "string") {
    return summarizeProviderError(error);
  }
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
      return summarizeProviderError((error as { message: string }).message);
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return summarizeProviderError(error.message);
  }
  return "Échec d'envoi WhatsApp.";
}

/** Évite de polluer les logs PM2 avec du HTML nginx (504/502…). */
function summarizeProviderError(raw: string): string {
  const text = raw.trim();
  if (/504\s*Gateway\s*Time-?out/i.test(text) || /<title>504/i.test(text)) {
    return "Gateway WhatsApp 504 (timeout nginx) — API messaging indisponible ou trop lente.";
  }
  if (/502\s*Bad\s*Gateway/i.test(text) || /<title>502/i.test(text)) {
    return "Gateway WhatsApp 502 — upstream messaging down.";
  }
  if (/503\s*Service/i.test(text) || /<title>503/i.test(text)) {
    return "Gateway WhatsApp 503 — service messaging indisponible.";
  }
  if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
    return "Réponse HTML inattendue du gateway messaging (pas JSON API).";
  }
  return text.slice(0, 500);
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
  /** Nature du message pour l’alternance multi-files (absence ↔ paiement…). */
  queueKind?: WhatsAppQueueKind;
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

  const queueKind = options.queueKind ?? "other";

  // Klambo / Meta : le pacing vit dans l’API (file appareil). Pas de double délai ici.
  if (usesMessagingApi(config.provider)) {
    return withWhatsAppGuardianRetry(async () => {
      const client = new MessagingClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      });
      const res =
        config.provider === "klambo"
          ? await client.send({
              to,
              channel: "whatsapp",
              type: "text",
              text:
                variables.code ||
                Object.values(variables).filter(Boolean).join(" | "),
              queue_kind: queueKind,
            })
          : await client.send({
              to,
              channel: "whatsapp",
              type: "template",
              template,
              lang: options.lang ?? "fr",
              variables,
              queue_kind: queueKind,
            });
      return {
        success: res.success,
        logId: res.logId,
        status: res.status,
      };
    }, formatZinduaError);
  }

  // Zindua : pacing local (ne passe pas par Klambo API)
  const paceProfile: WhatsAppPaceProfile = "qr";
  return enqueueWhatsAppTask(
    () =>
      withWhatsAppGuardianRetry(async () => {
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
    paceProfile,
    queueKind,
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
      queueKind: "mirror",
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
  locale?: MessagingLocale | null;
  branchId?: string | null;
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
export async function sendTransactionalWhatsAppViaProvider(options: {
  to: string;
  organizationId?: string | null;
  parts: Array<string | null | undefined>;
  attachments?: Array<{ url: string; filename?: string }>;
  queueKind?: WhatsAppQueueKind;
  locale?: MessagingLocale | null;
  branchId?: string | null;
}): Promise<WhatsAppSendOutcome> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    return { sent: false, error: "Numéro WhatsApp invalide.", channel: "none" };
  }

  const locale = await resolveSenderMessagingLocale({
    locale: options.locale,
    branchId: options.branchId,
  });

  try {
    const result = await sendWhatsApp({
      to,
      organizationId: options.organizationId,
      lang: messagingLocaleToWhatsAppLang(locale),
      queueKind: options.queueKind ?? "other",
      variables: {
        code: buildWhatsAppBody(options.parts),
      },
      attachments: options.attachments,
    });
    return outcomeFromSendResult(result);
  } catch (error) {
    const message = formatZinduaError(error);
    // eslint-disable-next-line no-console
    console.warn("[sendTransactionalWhatsAppViaProvider] échec:", message);
    return { sent: false, error: message, channel: "none" };
  }
}

/**
 * Canal exclusif : inbox Klambo ou gateway WhatsApp (selon Paramètres).
 */
export async function sendTransactionalWhatsApp(options: {
  to: string;
  organizationId?: string | null;
  parts: Array<string | null | undefined>;
  /** Carte riche inbox (`__NOTIFY__:{json}`). */
  richBody?: string | null;
  attachments?: Array<{ url: string; filename?: string }>;
  queueKind?: WhatsAppQueueKind;
  locale?: MessagingLocale | null;
  branchId?: string | null;
}): Promise<WhatsAppSendOutcome> {
  const { deliverSchoolNotify } = await import(
    "@/lib/notify/deliver-school-notify"
  );
  const result = await deliverSchoolNotify(options);
  return {
    sent: result.sent,
    error: result.error,
    channel: result.channel,
  };
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
  locale?: MessagingLocale | null;
  branchId?: string | null;
}): Promise<WhatsAppSendOutcome> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sendNewUserCredentialsWhatsApp] numéro invalide (« ${options.to} »)`,
    );
    return { sent: false, error: "Numéro WhatsApp invalide.", channel: "none" };
  }

  const locale = await resolveSenderMessagingLocale({
    locale: options.locale,
    branchId: options.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const loginUrl = resolveWhatsAppLoginUrl(options.loginUrl);
  const displayName = options.name.trim() || t("common.defaultParent");
  const role = options.role?.trim() || t("common.defaultRole");
  const branchLabel = options.branchName?.trim() || null;
  const brand = branchLabel || APP_NAME;

  const { serializeNotifyCard, notifyCardToWhatsAppParts } = await import(
    "@/lib/notify/notify-message-card"
  );

  const card = {
    v: 1 as const,
    tone: "amber" as const,
    brand,
    title: t("accountCreate.title"),
    intro: formatMessagingHello(t, displayName),
    rows: [
      {
        label: t("common.role"),
        value: role,
      },
      {
        label: t("common.email"),
        value: options.email,
        kind: "email" as const,
      },
      {
        label: t("common.temporaryPassword"),
        value: options.temporaryPassword,
        kind: "secret" as const,
      },
      {
        label: t("common.login"),
        value: loginUrl,
        kind: "link" as const,
      },
    ],
    note: t("accountCreate.waSecurity"),
    cta: {
      label: t("common.signInKlambo"),
      href: loginUrl,
    },
  };

  const richBody = serializeNotifyCard(card);
  const waParts = notifyCardToWhatsAppParts(card);

  try {
    // Inbox Klambo d'abord ; gateway WhatsApp en secours (file + pacing).
    const { deliverSchoolNotify } = await import(
      "@/lib/notify/deliver-school-notify"
    );
    const result = await deliverSchoolNotify({
      to,
      organizationId: options.organizationId,
      locale,
      branchId: options.branchId,
      queueKind: "credentials",
      parts: waParts,
      richBody,
    });
    if (result.sent) {
      // eslint-disable-next-line no-console
      console.info(
        `[sendNewUserCredentialsWhatsApp] ok to=${to} channel=${result.channel}`,
      );
    }
    return {
      sent: result.sent,
      error: result.error,
      channel: result.channel,
    };
  } catch (error) {
    const errMsg = formatZinduaError(error);
    // eslint-disable-next-line no-console
    console.warn("[sendNewUserCredentialsWhatsApp] échec:", errMsg);
    return { sent: false, error: errMsg, channel: "none" };
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
    return { sent: false, error: "Numéro WhatsApp invalide.", channel: "none" };
  }

  const locale = await resolveSenderMessagingLocale({
    locale: options.locale,
    branchId: options.branchId,
  });
  const t = await getMessagingTranslator(locale);
  const loginUrl = resolveWhatsAppLoginUrl(options.loginUrl);
  const displayName = options.name.trim() || t("common.defaultParent");
  const branchLabel = options.branchName?.trim() || null;
  const brand = branchLabel || APP_NAME;

  const { serializeNotifyCard, notifyCardToWhatsAppParts } = await import(
    "@/lib/notify/notify-message-card"
  );

  const card = {
    v: 1 as const,
    tone: "amber" as const,
    brand,
    title: t("passwordReset.title"),
    intro: formatMessagingHello(t, displayName),
    rows: [
      {
        label: t("common.email"),
        value: options.email,
        kind: "email" as const,
      },
      {
        label: t("common.newPassword"),
        value: options.temporaryPassword,
        kind: "secret" as const,
      },
      {
        label: t("common.login"),
        value: loginUrl,
        kind: "link" as const,
      },
    ],
    note: t("passwordReset.waSecurity"),
    cta: {
      label: t("common.signInKlambo"),
      href: loginUrl,
    },
  };

  const richBody = serializeNotifyCard(card);
  const waParts = notifyCardToWhatsAppParts(card);

  try {
    const { deliverSchoolNotify } = await import(
      "@/lib/notify/deliver-school-notify"
    );
    const result = await deliverSchoolNotify({
      to,
      organizationId: options.organizationId,
      locale,
      branchId: options.branchId,
      queueKind: "credentials",
      parts: waParts,
      richBody,
    });
    if (result.sent) {
      // eslint-disable-next-line no-console
      console.info(
        `[sendResetPasswordWhatsApp] ok to=${to} channel=${result.channel}`,
      );
    } else if (result.error) {
      // eslint-disable-next-line no-console
      console.warn(
        `[sendResetPasswordWhatsApp] échec: ${formatZinduaError(result.error)}`,
      );
    }
    return {
      sent: result.sent,
      error: result.error,
      channel: result.channel,
    };
  } catch (error) {
    const errMsg = formatZinduaError(error);
    // eslint-disable-next-line no-console
    console.warn("[sendResetPasswordWhatsApp] échec:", errMsg);
    return { sent: false, error: errMsg, channel: "none" };
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

  if (config.provider === "inbox") {
    return {
      ...base,
      sendingEnabled: false,
      connected: true,
      status: "inbox",
      projectName: "Klambo Inbox (messagerie app)",
      envEnabled: false,
    };
  }

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
  locale?: MessagingLocale | null;
}): Promise<WhatsAppSendOutcome> {
  const to = resolveWhatsAppTo(options.to);
  if (!to) {
    return { sent: false, error: "Numéro WhatsApp invalide." };
  }

  const config = await getWhatsAppRuntimeConfig(options.organizationId);
  if (config.provider === "inbox") {
    return {
      sent: false,
      error:
        "Canal actif = Klambo Inbox. Basculez sur Zindua / KlamboWhatsapp / Meta pour un test WhatsApp.",
    };
  }
  const label = providerLabel(config.provider);
  const locale = await resolveSenderMessagingLocale({
    locale: options.locale,
  });

  try {
    const result = await sendWhatsApp({
      to,
      organizationId: options.organizationId,
      force: true,
      lang: messagingLocaleToWhatsAppLang(locale),
      queueKind: "test",
      variables: {
        code: `Test Klambocore — vérification ${label}. Ignorez si vous n'êtes pas concerné.`,
      },
    });
    return outcomeFromSendResult(result, "Envoi WhatsApp désactivé.");
  } catch (error) {
    return { sent: false, error: formatZinduaError(error) };
  }
}
