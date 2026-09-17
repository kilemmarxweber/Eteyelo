import "server-only";

import { prisma } from "@/lib/prisma";

export type WhatsAppProviderId = "zindua" | "klambo" | "meta";

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
  if (process.env.ZINDUA_WHATSAPP_ENABLED != null) {
    return envFlagEnabled(process.env.ZINDUA_WHATSAPP_ENABLED);
  }
  return envFlagEnabled(process.env.MESSAGING_WHATSAPP_ENABLED);
}

function envProvider(): WhatsAppProviderId {
  return parseProvider(process.env.WHATSAPP_PROVIDER);
}

function envApiKeyFor(provider: WhatsAppProviderId): string {
  if (provider === "meta") {
    return (
      process.env.MESSAGING_META_API_KEY?.trim() ||
      process.env.MESSAGING_API_KEY?.trim() ||
      process.env.ZINDUA_API_KEY?.trim() ||
      ""
    );
  }
  if (provider === "klambo") {
    return (
      process.env.MESSAGING_API_KEY?.trim() ||
      process.env.ZINDUA_API_KEY?.trim() ||
      ""
    );
  }
  return (
    process.env.ZINDUA_API_KEY?.trim() ||
    process.env.MESSAGING_API_KEY?.trim() ||
    ""
  );
}

function envTemplateFor(provider: WhatsAppProviderId): string {
  if (provider === "klambo" || provider === "meta") {
    return (
      process.env.MESSAGING_WHATSAPP_TEMPLATE?.trim() ||
      process.env.ZINDUA_WHATSAPP_MAIL_TEMPLATE?.trim() ||
      "notification"
    );
  }
  return (
    process.env.ZINDUA_WHATSAPP_MAIL_TEMPLATE?.trim() ||
    process.env.MESSAGING_WHATSAPP_TEMPLATE?.trim() ||
    "notification"
  );
}

function envSiteUrl(): string | undefined {
  const raw =
    process.env.ZINDUA_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "";
  const cleaned = raw.replace(/\/$/, "");
  return cleaned || undefined;
}

function envBaseUrl(): string | undefined {
  const raw =
    process.env.MESSAGING_API_BASE_URL?.trim() || "http://localhost:3001";
  const cleaned = raw.replace(/\/$/, "");
  return cleaned || undefined;
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
    apiKey: envApiKeyFor(provider),
    template: envTemplateFor(provider),
    siteUrl: envSiteUrl() ?? "",
    baseUrl: envBaseUrl() ?? "http://localhost:3001",
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

  const resolvedProvider = org?.whatsappProvider?.trim()
    ? parseProvider(org.whatsappProvider)
    : defaults.provider;

  const apiKey = org?.whatsappApiKey?.trim() || envApiKeyFor(resolvedProvider);
  const template =
    org?.whatsappTemplate?.trim() || envTemplateFor(resolvedProvider);
  const siteUrl =
    org?.whatsappSiteUrl?.replace(/\/$/, "").trim() ||
    defaults.siteUrl ||
    undefined;
  const baseUrl =
    org?.whatsappBaseUrl?.replace(/\/$/, "").trim() ||
    defaults.baseUrl ||
    undefined;
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
