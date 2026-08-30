import "server-only";

import { prisma } from "@/lib/prisma";

export type WhatsAppRuntimeConfig = {
  /** Envoi autorisé (toggle UI + .env + clé API). */
  enabled: boolean;
  apiKey: string;
  template: string;
  siteUrl: string | undefined;
  providerConfigured: boolean;
};

function envFlagEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  if (!value) return true;
  return value !== "false" && value !== "0" && value !== "off" && value !== "no";
}

export function isEnvWhatsAppEnabled(): boolean {
  return envFlagEnabled(process.env.ZINDUA_WHATSAPP_ENABLED);
}

function envApiKey(): string {
  return process.env.ZINDUA_API_KEY?.trim() || "";
}

function envTemplate(): string {
  return process.env.ZINDUA_WHATSAPP_MAIL_TEMPLATE?.trim() || "notification";
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

/** Valeurs .env affichées / utilisées si la config UI est vide. */
export function getWhatsAppEnvDefaults(): {
  enabled: boolean;
  apiKey: string;
  template: string;
  siteUrl: string;
} {
  return {
    enabled: isEnvWhatsAppEnabled(),
    apiKey: envApiKey(),
    template: envTemplate(),
    siteUrl: envSiteUrl() ?? "",
  };
}

export function isWhatsAppProviderConfigured(): boolean {
  return Boolean(envApiKey());
}

function resolveEnabled(input: {
  uiEnabled: boolean;
  apiKey: string;
}): boolean {
  return input.uiEnabled && isEnvWhatsAppEnabled() && Boolean(input.apiKey);
}

/**
 * Config d'envoi WhatsApp.
 * UI d'abord, .env si champ vide. Si désactivé dans l'UI (ou .env), aucun envoi.
 */
export async function getWhatsAppRuntimeConfig(
  organizationId?: string | null,
): Promise<WhatsAppRuntimeConfig> {
  const defaults = getWhatsAppEnvDefaults();

  if (!organizationId?.trim()) {
    const apiKey = defaults.apiKey;
    const enabled = resolveEnabled({
      uiEnabled: defaults.enabled,
      apiKey,
    });
    return {
      enabled,
      apiKey,
      template: defaults.template,
      siteUrl: defaults.siteUrl || undefined,
      providerConfigured: Boolean(apiKey),
    };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      whatsappEnabled: true,
      whatsappApiKey: true,
      whatsappTemplate: true,
      whatsappSiteUrl: true,
    },
  });

  const apiKey = org?.whatsappApiKey?.trim() || defaults.apiKey;
  const template = org?.whatsappTemplate?.trim() || defaults.template;
  const siteUrl =
    org?.whatsappSiteUrl?.replace(/\/$/, "").trim() || defaults.siteUrl || undefined;
  const uiEnabled = org?.whatsappEnabled ?? defaults.enabled;

  return {
    enabled: resolveEnabled({ uiEnabled, apiKey }),
    apiKey,
    template,
    siteUrl,
    providerConfigured: Boolean(apiKey),
  };
}

export async function isWhatsAppSendingEnabled(
  organizationId?: string | null,
): Promise<boolean> {
  const config = await getWhatsAppRuntimeConfig(organizationId);
  return config.enabled;
}
