"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import { action } from "@/lib/zsa";
import { syncWhatsAppEnvFile, applyWhatsAppEnvRuntime } from "@/lib/whatsapp-env-file";
import { getWhatsAppEnvDefaults } from "@/lib/whatsapp-settings";

function assertCanManage(
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"],
) {
  if (!canAccessBranchOrgSettings(session)) {
    throw new Error("Action non autorisée.");
  }
}

const whatsappSettingsSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string().trim().max(200),
  template: z.string().trim().max(80),
  siteUrl: z.string().trim().max(300),
});

function presentSettings(org: {
  whatsappEnabled: boolean;
  whatsappApiKey: string | null;
  whatsappTemplate: string | null;
  whatsappSiteUrl: string | null;
}) {
  const defaults = getWhatsAppEnvDefaults();
  const apiKey = org.whatsappApiKey?.trim() || defaults.apiKey;
  return {
    enabled: org.whatsappEnabled,
    apiKey,
    template: org.whatsappTemplate?.trim() || defaults.template,
    siteUrl: org.whatsappSiteUrl?.trim() || defaults.siteUrl,
    providerConfigured: Boolean(apiKey),
  };
}

export const getWhatsAppSettingsAction = action.handler(async () => {
  const { organizationId, session } = await requireBranchContext();
  assertCanManage(session);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      whatsappEnabled: true,
      whatsappApiKey: true,
      whatsappTemplate: true,
      whatsappSiteUrl: true,
    },
  });

  const defaults = getWhatsAppEnvDefaults();
  if (!org) {
    return {
      enabled: defaults.enabled,
      apiKey: defaults.apiKey,
      template: defaults.template,
      siteUrl: defaults.siteUrl,
      providerConfigured: Boolean(defaults.apiKey),
    };
  }

  return presentSettings(org);
});

export const updateWhatsAppSettingsAction = action
  .input(whatsappSettingsSchema)
  .handler(async ({ input }) => {
    const { organizationId, session, branchId } = await requireBranchContext();
    assertCanManage(session);

    const apiKey = input.apiKey.trim();
    const template = input.template.trim();
    const siteUrl = input.siteUrl.trim().replace(/\/$/, "");

    if (siteUrl && !/^https?:\/\//i.test(siteUrl)) {
      throw new Error("L’URL du site doit commencer par http:// ou https://.");
    }

    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        whatsappEnabled: input.enabled,
        whatsappApiKey: apiKey || null,
        whatsappTemplate: template || null,
        whatsappSiteUrl: siteUrl || null,
      },
      select: {
        whatsappEnabled: true,
        whatsappApiKey: true,
        whatsappTemplate: true,
        whatsappSiteUrl: true,
      },
    });

    const envUpdates: Parameters<typeof syncWhatsAppEnvFile>[0] = {
      ZINDUA_WHATSAPP_ENABLED: input.enabled ? "true" : "false",
    };
    if (apiKey) envUpdates.ZINDUA_API_KEY = apiKey;
    if (template) envUpdates.ZINDUA_WHATSAPP_MAIL_TEMPLATE = template;
    if (siteUrl) envUpdates.ZINDUA_SITE_URL = siteUrl;
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

    return presentSettings(org);
  });
