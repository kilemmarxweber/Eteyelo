"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import { action } from "@/lib/zsa";
import {
  syncWhatsAppEnvFile,
  applyWhatsAppEnvRuntime,
} from "@/lib/whatsapp-env-file";
import {
  envDefaultsByProvider,
  getWhatsAppEnvDefaults,
  getWhatsAppEnvDefaultsFor,
  usesMessagingApi,
  type WhatsAppProviderId,
} from "@/lib/whatsapp-settings";
import {
  getZinduaWhatsAppStatus,
  sendWhatsAppTest,
  type ZinduaWhatsAppChannelStatus,
} from "@/lib/zindua";

function assertCanManage(
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"],
) {
  if (!canAccessBranchOrgSettings(session)) {
    throw new Error("Action non autorisée.");
  }
}

const whatsappSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["zindua", "klambo", "meta"]),
  apiKey: z.string().trim().max(200),
  template: z.string().trim().max(80),
  siteUrl: z.string().trim().max(300),
  baseUrl: z.string().trim().max(300),
});

function normalizeProvider(raw: string | null | undefined): WhatsAppProviderId {
  const value = raw?.trim().toLowerCase();
  if (value === "meta") return "meta";
  if (value === "klambo" || value === "klambowhatsapp") return "klambo";
  return "zindua";
}

function presentSettings(org: {
  whatsappEnabled: boolean;
  whatsappProvider: string | null;
  whatsappApiKey: string | null;
  whatsappTemplate: string | null;
  whatsappSiteUrl: string | null;
  whatsappBaseUrl: string | null;
}) {
  const defaults = getWhatsAppEnvDefaults();
  const provider = normalizeProvider(
    org.whatsappProvider?.trim() || defaults.provider,
  );
  // Org UI d'abord ; sinon .env du provider sélectionné (Meta → MESSAGING_META_API_KEY…)
  const envForProvider = getWhatsAppEnvDefaultsFor(provider);
  const apiKey = org.whatsappApiKey?.trim() || envForProvider.apiKey;
  return {
    enabled: org.whatsappEnabled,
    provider,
    apiKey,
    template: org.whatsappTemplate?.trim() || envForProvider.template,
    siteUrl: org.whatsappSiteUrl?.trim() || envForProvider.siteUrl,
    baseUrl: org.whatsappBaseUrl?.trim() || envForProvider.baseUrl,
    providerConfigured: Boolean(apiKey),
    fromEnv: {
      apiKey: !org.whatsappApiKey?.trim() && Boolean(envForProvider.apiKey),
      baseUrl: !org.whatsappBaseUrl?.trim() && Boolean(envForProvider.baseUrl),
    },
    envByProvider: envDefaultsByProvider(),
  };
}

async function presentSettingsWithStatus(
  org: {
    whatsappEnabled: boolean;
    whatsappProvider: string | null;
    whatsappApiKey: string | null;
    whatsappTemplate: string | null;
    whatsappSiteUrl: string | null;
    whatsappBaseUrl: string | null;
  },
  organizationId: string,
) {
  const settings = presentSettings(org);
  let channel: ZinduaWhatsAppChannelStatus;
  try {
    channel = await getZinduaWhatsAppStatus(organizationId);
  } catch {
    channel = {
      sendingEnabled: false,
      envEnabled: true,
      connected: false,
      status: null,
      setupUrl: null,
      projectName: null,
      provider: settings.provider,
      error: "Impossible de joindre le fournisseur WhatsApp.",
    };
  }
  return { ...settings, zindua: channel, channel };
}

const orgSelect = {
  whatsappEnabled: true,
  whatsappProvider: true,
  whatsappApiKey: true,
  whatsappTemplate: true,
  whatsappSiteUrl: true,
  whatsappBaseUrl: true,
} as const;

export const getWhatsAppSettingsAction = action.handler(async () => {
  const { organizationId, session } = await requireBranchContext();
  assertCanManage(session);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: orgSelect,
  });

  const defaults = getWhatsAppEnvDefaults();
  if (!org) {
    const channel = await getZinduaWhatsAppStatus(organizationId);
    const envForProvider = getWhatsAppEnvDefaultsFor(defaults.provider);
    return {
      enabled: defaults.enabled,
      provider: defaults.provider,
      apiKey: defaults.apiKey,
      template: defaults.template,
      siteUrl: defaults.siteUrl,
      baseUrl: defaults.baseUrl,
      providerConfigured: Boolean(defaults.apiKey),
      fromEnv: {
        apiKey: Boolean(envForProvider.apiKey),
        baseUrl: Boolean(envForProvider.baseUrl),
      },
      envByProvider: envDefaultsByProvider(),
      zindua: channel,
      channel,
    };
  }

  return presentSettingsWithStatus(org, organizationId);
});

export const updateWhatsAppSettingsAction = action
  .input(whatsappSettingsSchema)
  .handler(async ({ input }) => {
    const { organizationId, session, branchId } = await requireBranchContext();
    assertCanManage(session);

    const apiKey = input.apiKey.trim();
    const template = input.template.trim();
    const siteUrl = input.siteUrl.trim().replace(/\/$/, "");
    const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
    const provider = input.provider;

    if (siteUrl && !/^https?:\/\//i.test(siteUrl)) {
      throw new Error("L’URL du site doit commencer par http:// ou https://.");
    }
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      throw new Error(
        "L’URL de l’API Klambo doit commencer par http:// ou https://.",
      );
    }

    // Champ vide = garder le .env (ne pas écraser avec une chaîne vide en DB)
    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        whatsappEnabled: input.enabled,
        whatsappProvider: provider,
        whatsappApiKey: apiKey || null,
        whatsappTemplate: template || null,
        whatsappSiteUrl: siteUrl || null,
        whatsappBaseUrl: baseUrl || null,
      },
      select: orgSelect,
    });

    const enabledFlag = input.enabled ? "true" : "false";
    const envUpdates: Parameters<typeof syncWhatsAppEnvFile>[0] = {
      WHATSAPP_PROVIDER: provider,
      ZINDUA_WHATSAPP_ENABLED: enabledFlag,
      MESSAGING_WHATSAPP_ENABLED: enabledFlag,
    };

    // N'écrit le .env que si l'utilisateur a saisi une valeur (sinon on conserve le .env existant)
    if (usesMessagingApi(provider)) {
      if (provider === "meta" && apiKey) {
        envUpdates.MESSAGING_META_API_KEY = apiKey;
        envUpdates.MESSAGING_API_KEY = apiKey;
      } else if (apiKey) {
        envUpdates.MESSAGING_API_KEY = apiKey;
      }
      if (template) envUpdates.MESSAGING_WHATSAPP_TEMPLATE = template;
      if (baseUrl) envUpdates.MESSAGING_API_BASE_URL = baseUrl;
    } else {
      if (apiKey) envUpdates.ZINDUA_API_KEY = apiKey;
      if (template) envUpdates.ZINDUA_WHATSAPP_MAIL_TEMPLATE = template;
      if (siteUrl) envUpdates.ZINDUA_SITE_URL = siteUrl;
    }

    try {
      syncWhatsAppEnvFile(envUpdates);
    } catch (error) {
      applyWhatsAppEnvRuntime(envUpdates);
      console.warn(
        "[whatsapp] .env non mis à jour:",
        error instanceof Error ? error.message : error,
      );
    }

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/settings/whatsapp`,
    );

    return presentSettingsWithStatus(org, organizationId);
  });

const whatsappTestSchema = z.object({
  to: z.string().trim().min(8).max(24),
});

export const sendWhatsAppTestAction = action
  .input(whatsappTestSchema)
  .handler(async ({ input }) => {
    const { organizationId, session } = await requireBranchContext();
    assertCanManage(session);

    const result = await sendWhatsAppTest({
      to: input.to,
      organizationId,
    });
    if (!result.sent) {
      throw new Error(result.error || "WhatsApp non délivré.");
    }
    return { ok: true as const };
  });
