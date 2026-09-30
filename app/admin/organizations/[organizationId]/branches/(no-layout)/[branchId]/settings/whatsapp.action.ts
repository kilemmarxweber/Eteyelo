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
  isInboxProvider,
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
  provider: z.enum(["inbox", "zindua", "klambo", "meta"]),
  apiKey: z.string().trim().max(200),
  template: z.string().trim().max(80),
  siteUrl: z.string().trim().max(300),
  baseUrl: z.string().trim().max(300),
});

function normalizeProvider(raw: string | null | undefined): WhatsAppProviderId {
  const value = raw?.trim().toLowerCase();
  if (isInboxProvider(value)) return "inbox";
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
  const rawProvider = normalizeProvider(
    org.whatsappProvider?.trim() || defaults.provider,
  );
  // Exclusif : WhatsApp coupé → canal inbox
  const provider =
    org.whatsappEnabled === false || isInboxProvider(rawProvider)
      ? ("inbox" as const)
      : rawProvider;
  const envForProvider = getWhatsAppEnvDefaultsFor(
    provider === "inbox" ? "zindua" : provider,
  );

  if (provider === "inbox") {
    return {
      enabled: false,
      provider: "inbox" as const,
      apiKey: "",
      template: org.whatsappTemplate?.trim() || "notification",
      siteUrl: "",
      baseUrl: "",
      providerConfigured: true,
      fromEnv: { apiKey: false, baseUrl: false },
      envOnly: false as const,
      envByProvider: envDefaultsByProvider(),
    };
  }

  // Meta = env only (pas de clé / URL UI)
  if (provider === "meta") {
    return {
      enabled: org.whatsappEnabled,
      provider,
      apiKey: "",
      template: org.whatsappTemplate?.trim() || envForProvider.template,
      siteUrl: "",
      baseUrl: envForProvider.baseUrl,
      providerConfigured: Boolean(envForProvider.apiKey),
      fromEnv: { apiKey: true, baseUrl: true },
      envOnly: true as const,
      envByProvider: envDefaultsByProvider(),
    };
  }

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
    envOnly: false as const,
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
    const isInbox = defaults.provider === "inbox";
    const envForProvider = getWhatsAppEnvDefaultsFor(
      isInbox ? "zindua" : defaults.provider,
    );
    const isMeta = defaults.provider === "meta";
    return {
      enabled: isInbox ? false : defaults.enabled,
      provider: defaults.provider,
      apiKey: isInbox || isMeta ? "" : defaults.apiKey,
      template: defaults.template,
      siteUrl: isInbox || isMeta ? "" : defaults.siteUrl,
      baseUrl: isInbox ? "" : defaults.baseUrl,
      providerConfigured: isInbox ? true : Boolean(envForProvider.apiKey),
      fromEnv: {
        apiKey: Boolean(envForProvider.apiKey),
        baseUrl: Boolean(envForProvider.baseUrl),
      },
      envOnly: isMeta,
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

    const template = input.template.trim();
    const siteUrl = input.siteUrl.trim().replace(/\/$/, "");
    const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
    const provider = input.provider;
    const isInbox = provider === "inbox";
    // Exclusif : inbox = WhatsApp off ; gateway = WhatsApp on
    const enabled = isInbox ? false : true;
    const apiKey =
      isInbox || provider === "meta" ? "" : input.apiKey.trim();

    if (!isInbox && provider !== "meta" && siteUrl && !/^https?:\/\//i.test(siteUrl)) {
      throw new Error("L’URL du site doit commencer par http:// ou https://.");
    }
    if (
      !isInbox &&
      provider !== "meta" &&
      baseUrl &&
      !/^https?:\/\//i.test(baseUrl)
    ) {
      throw new Error(
        "L’URL de l’API Klambo doit commencer par http:// ou https://.",
      );
    }

    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        whatsappEnabled: enabled,
        whatsappProvider: provider,
        whatsappApiKey: isInbox || provider === "meta" ? null : apiKey || null,
        whatsappTemplate: isInbox ? null : template || null,
        whatsappSiteUrl:
          isInbox || provider === "meta" ? null : siteUrl || null,
        whatsappBaseUrl:
          isInbox || provider === "meta" ? null : baseUrl || null,
      },
      select: orgSelect,
    });

    const enabledFlag = enabled ? "true" : "false";
    const envUpdates: Parameters<typeof syncWhatsAppEnvFile>[0] = {
      WHATSAPP_PROVIDER: provider,
      ZINDUA_WHATSAPP_ENABLED: enabledFlag,
      MESSAGING_WHATSAPP_ENABLED: enabledFlag,
      // Inbox seul ↔ NOTIFY on ; gateway seul ↔ NOTIFY off
      NOTIFY_KLAMBO_APP_FIRST: isInbox ? "true" : "false",
    };

    if (isInbox) {
      // Pas de clé / template gateway
    } else if (provider === "meta") {
      if (template) envUpdates.MESSAGING_WHATSAPP_TEMPLATE = template;
    } else if (usesMessagingApi(provider)) {
      if (apiKey) envUpdates.MESSAGING_API_KEY = apiKey;
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
