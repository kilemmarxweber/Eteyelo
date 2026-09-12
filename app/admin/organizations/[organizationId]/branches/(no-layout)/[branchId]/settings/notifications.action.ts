"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import { action } from "@/lib/zsa";
import { getNotificationPolicy } from "@/lib/notification-channels";
import {
  NOTIFICATION_EVENT_KEYS,
  serializeNotificationChannels,
} from "@/lib/notification-channels-shared";
import { applyWhatsAppEnvRuntime, syncWhatsAppEnvFile } from "@/lib/whatsapp-env-file";
import { getZinduaWhatsAppStatus } from "@/lib/zindua";
import type { Prisma } from "@/prisma/generated/prisma/client";

function assertCanManage(
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"],
) {
  if (!canAccessBranchOrgSettings(session)) {
    throw new Error("Action non autorisée.");
  }
}

const channelFlagsSchema = z.object({
  email: z.boolean(),
  whatsapp: z.boolean(),
});

const eventsSchema = z.object(
  Object.fromEntries(
    NOTIFICATION_EVENT_KEYS.map((key) => [key, channelFlagsSchema]),
  ) as Record<(typeof NOTIFICATION_EVENT_KEYS)[number], typeof channelFlagsSchema>,
);

const updateSchema = z.object({
  emailMaster: z.boolean(),
  whatsappMaster: z.boolean(),
  events: eventsSchema,
});

async function presentNotificationSettings(organizationId: string) {
  const [policy, zindua] = await Promise.all([
    getNotificationPolicy(organizationId),
    getZinduaWhatsAppStatus(organizationId).catch(() => ({
      sendingEnabled: false,
      envEnabled: true,
      connected: false,
      status: null,
      setupUrl: null,
      projectName: null,
      error: "Impossible de joindre Zindua.",
    })),
  ]);

  return {
    emailMaster: policy.emailMaster,
    whatsappMaster: policy.whatsappMaster,
    events: policy.events,
    zindua: {
      connected: zindua.connected,
      status: zindua.status,
      setupUrl: zindua.setupUrl,
      envEnabled: zindua.envEnabled,
      error: zindua.error ?? null,
    },
  };
}

export const getNotificationSettingsAction = action.handler(async () => {
  const { organizationId, session } = await requireBranchContext();
  assertCanManage(session);
  return presentNotificationSettings(organizationId);
});

export const updateNotificationSettingsAction = action
  .input(updateSchema)
  .handler(async ({ input }) => {
    const { organizationId, session, branchId } = await requireBranchContext();
    assertCanManage(session);

    const events = serializeNotificationChannels(input.events);
    const notifyParentOnPayment =
      events.payment.email || events.payment.whatsapp;

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        emailNotificationsEnabled: input.emailMaster,
        whatsappEnabled: input.whatsappMaster,
        notificationChannels: JSON.parse(
          JSON.stringify(events),
        ) as Prisma.InputJsonValue,
        notifyParentOnPayment,
      },
    });

    const envUpdates = {
      ZINDUA_WHATSAPP_ENABLED: input.whatsappMaster ? "true" : "false",
    } as const;
    try {
      syncWhatsAppEnvFile({ ...envUpdates });
    } catch (error) {
      applyWhatsAppEnvRuntime({ ...envUpdates });
      console.warn(
        "[notifications] .env WhatsApp non mis à jour:",
        error instanceof Error ? error.message : error,
      );
    }

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/settings/notifications`,
    );
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/settings/whatsapp`,
    );

    return presentNotificationSettings(organizationId);
  });
