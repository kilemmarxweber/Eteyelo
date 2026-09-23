import "server-only";

import { prisma } from "@/lib/prisma";
import { envRaw } from "@/lib/whatsapp-env-file";

export type WhatsAppProviderId = "zindua" | "klambo" | "meta";

/** API KlamboWhatsapp prod (TVS : KLAMBO_BASE_URL). */
export const KLAMBO_WHATSAPP_API_URL = "https://whatsapp-api.klambocore.com";

function isLoopbackUrl(url?: string | null): boolean {
  const raw = url?.trim();
  if (!raw) return true;
  try {
    const host = new URL(raw).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(raw);
  }
}

export type WhatsAppRuntimeConfig = {
  /** Envoi autorisé (toggle UI + .env + clé API). */
  enabled: boolean;
  provider: WhatsAppProviderId;
  apiKey: string;
  template: string;
  siteUrl: string | undefined;
  /** Base URL KlamboWhatsapp (ignoré pour Zindua). */
  baseUrl: string | undefined;
  providerConfigured: boolean;
};

function envFlagEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  if (!value) return true;
  return value !== "false" && value !== "0" && value !== "off" && value !== "no";
}

function parseProvider(raw: string | null | undefined): WhatsAppProviderId {
  const value = raw?.trim().toLowerCase();
  if (value === "meta" || value === "whatsapp-meta" || value === "cloud") {
    return "meta";
  }
  if (value === "klambo" || value === "klambowhatsapp") {
    return "klambo";
  }
  return "zindua";
}

export function isEnvWhatsAppEnabled(): boolean {
  const zindua = envRaw("ZINDUA_WHATSAPP_ENABLED");
  if (zindua != null) {
    return envFlagEnabled(zindua);
  }
  return envFlagEnabled(envRaw("MESSAGING_WHATSAPP_ENABLED"));
}

function envProvider(): WhatsAppProviderId {
  return parseProvider(envRaw("WHATSAPP_PROVIDER"));
}

function envApiKeyFor(provider: WhatsAppProviderId): string {
  if (provider === "meta") {
    return (
      envRaw("MESSAGING_META_API_KEY")?.trim() ||
      envRaw("MESSAGING_API_KEY")?.trim() ||
      envRaw("ZINDUA_API_KEY")?.trim() ||
      ""
    );
  }
  if (provider === "klambo") {
    return (
      envRaw("MESSAGING_API_KEY")?.trim() ||
      envRaw("ZINDUA_API_KEY")?.trim() ||
      ""
    );
  }
  return (
    envRaw("ZINDUA_API_KEY")?.trim() ||
    envRaw("MESSAGING_API_KEY")?.trim() ||
    ""
  );
}

function envTemplateFor(provider: WhatsAppProviderId): string {
  if (provider === "klambo" || provider === "meta") {
    return (
      envRaw("MESSAGING_WHATSAPP_TEMPLATE")?.trim() ||
      envRaw("ZINDUA_WHATSAPP_MAIL_TEMPLATE")?.trim() ||
      "notification"
    );
  }
  return (
    envRaw("ZINDUA_WHATSAPP_MAIL_TEMPLATE")?.trim() ||
    envRaw("MESSAGING_WHATSAPP_TEMPLATE")?.trim() ||
    "notification"
  );
}

function envSiteUrl(): string | undefined {
  const raw =
    envRaw("ZINDUA_SITE_URL")?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "";
  const cleaned = raw.replace(/\/$/, "");
  return cleaned || undefined;
}

function envBaseUrl(): string | undefined {
  const raw =
    envRaw("MESSAGING_API_BASE_URL")?.trim() ||
    process.env.KLAMBO_BASE_URL?.trim() ||
    KLAMBO_WHATSAPP_API_URL;
  const cleaned = raw.replace(/\/$/, "");
  return cleaned || undefined;
}

/** Valeurs .env pour un provider donné (affichage / repli UI). */
export function getWhatsAppEnvDefaultsFor(provider: WhatsAppProviderId): {
  apiKey: string;
  template: string;
  siteUrl: string;
  baseUrl: string;
} {
  return {
    apiKey: envApiKeyFor(provider),
    template: envTemplateFor(provider),
    siteUrl: envSiteUrl() ?? "",
    baseUrl: envBaseUrl() ?? KLAMBO_WHATSAPP_API_URL,
  };
}

/** Valeurs .env affichées / utilisées si la config UI est vide. */
export function getWhatsAppEnvDefaults(): {
  enabled: boolean;
  provider: WhatsAppProviderId;
  apiKey: string;
  template: string;
  siteUrl: string;
  baseUrl: string;
} {
  const provider = envProvider();
  return {
    enabled: isEnvWhatsAppEnabled(),
    provider,
    ...getWhatsAppEnvDefaultsFor(provider),
  };
}

export function envDefaultsByProvider(): Record<
  WhatsAppProviderId,
  ReturnType<typeof getWhatsAppEnvDefaultsFor>
> {
  return {
    zindua: getWhatsAppEnvDefaultsFor("zindua"),
    klambo: getWhatsAppEnvDefaultsFor("klambo"),
    meta: getWhatsAppEnvDefaultsFor("meta"),
  };
}

export function isWhatsAppProviderConfigured(): boolean {
  const defaults = getWhatsAppEnvDefaults();
  return Boolean(defaults.apiKey);
}

function resolveEnabled(input: {
  uiEnabled: boolean;
  apiKey: string;
}): boolean {
  return input.uiEnabled && isEnvWhatsAppEnabled() && Boolean(input.apiKey);
}

/**
 * Config d'envoi WhatsApp (Zindua | KlamboWhatsapp | Meta).
 * UI d'abord, .env si champ vide. Si désactivé, aucun envoi.
 */
export async function getWhatsAppRuntimeConfig(
  organizationId?: string | null,
): Promise<WhatsAppRuntimeConfig> {
  const defaults = getWhatsAppEnvDefaults();

  if (!organizationId?.trim()) {
    const apiKey = defaults.apiKey;
    return {
      enabled: resolveEnabled({ uiEnabled: defaults.enabled, apiKey }),
      provider: defaults.provider,
      apiKey,
      template: defaults.template,
      siteUrl: defaults.siteUrl || undefined,
      baseUrl: defaults.baseUrl || undefined,
      providerConfigured: Boolean(apiKey),
    };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      whatsappEnabled: true,
      whatsappProvider: true,
      whatsappApiKey: true,
      whatsappTemplate: true,
      whatsappSiteUrl: true,
      whatsappBaseUrl: true,
    },
  });

  const orgBaseUrl = org?.whatsappBaseUrl?.replace(/\/$/, "").trim() || "";
  const orgIsLocal = isLoopbackUrl(orgBaseUrl);
  const resolvedProvider =
    !orgIsLocal && org?.whatsappProvider?.trim()
      ? parseProvider(org.whatsappProvider)
      : defaults.provider;

  const envForProvider = getWhatsAppEnvDefaultsFor(resolvedProvider);

  // Meta : uniquement .env (MESSAGING_META_API_KEY + MESSAGING_API_BASE_URL)
  // — la clé doit cibler un projet Klambo avec whatsappProvider=meta
  const apiKey =
    resolvedProvider === "meta"
      ? envForProvider.apiKey
      : org?.whatsappApiKey?.trim() || envForProvider.apiKey;
  const template =
    org?.whatsappTemplate?.trim() || envForProvider.template;
  const siteUrl =
    resolvedProvider === "meta"
      ? undefined
      : org?.whatsappSiteUrl?.replace(/\/$/, "").trim() ||
        envForProvider.siteUrl ||
        undefined;
  const baseUrl =
    resolvedProvider === "meta" || orgIsLocal
      ? envForProvider.baseUrl || undefined
      : orgBaseUrl || envForProvider.baseUrl || undefined;
  const uiEnabled = org?.whatsappEnabled ?? defaults.enabled;

  return {
    enabled: resolveEnabled({ uiEnabled, apiKey }),
    provider: resolvedProvider,
    apiKey,
    template,
    siteUrl,
    baseUrl,
    providerConfigured: Boolean(apiKey),
  };
}

export async function isWhatsAppSendingEnabled(
  organizationId?: string | null,
): Promise<boolean> {
  const config = await getWhatsAppRuntimeConfig(organizationId);
  return config.enabled;
}

export function providerLabel(provider: WhatsAppProviderId): string {
  if (provider === "meta") return "Meta WhatsApp";
  if (provider === "klambo") return "KlamboWhatsapp";
  return "Zindua";
}

export function usesMessagingApi(provider: WhatsAppProviderId): boolean {
  return provider === "klambo" || provider === "meta";
}
