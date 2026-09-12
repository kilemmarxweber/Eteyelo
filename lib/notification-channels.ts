import "server-only";

import { prisma } from "@/lib/prisma";
import { isWhatsAppSendingEnabled } from "@/lib/whatsapp-settings";
import {
  DEFAULT_NOTIFICATION_CHANNEL,
  emptyNotificationChannelsMap,
  parseNotificationChannels,
  type NotificationChannelFlags,
  type NotificationChannelsMap,
  type NotificationEvent,
} from "@/lib/notification-channels-shared";

export {
  DEFAULT_NOTIFICATION_CHANNEL,
  emptyNotificationChannelsMap,
  NOTIFICATION_EVENT_KEYS,
  NOTIFICATION_EVENT_META,
  parseNotificationChannels,
  serializeNotificationChannels,
  type NotificationChannelFlags,
  type NotificationChannelsMap,
  type NotificationEvent,
} from "@/lib/notification-channels-shared";

export type NotificationPolicy = {
  emailMaster: boolean;
  whatsappMaster: boolean;
  events: NotificationChannelsMap;
};

export async function getNotificationPolicy(
  organizationId?: string | null,
): Promise<NotificationPolicy> {
  if (!organizationId?.trim()) {
    return {
      emailMaster: true,
      whatsappMaster: await isWhatsAppSendingEnabled(null),
      events: emptyNotificationChannelsMap(),
    };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      emailNotificationsEnabled: true,
      whatsappEnabled: true,
      notificationChannels: true,
      notifyParentOnPayment: true,
    },
  });

  return {
    emailMaster: org?.emailNotificationsEnabled ?? true,
    whatsappMaster: org?.whatsappEnabled ?? true,
    events: parseNotificationChannels(org?.notificationChannels, {
      notifyParentOnPayment: org?.notifyParentOnPayment ?? true,
    }),
  };
}

export async function resolveNotificationChannels(
  organizationId: string | null | undefined,
  event: NotificationEvent,
): Promise<NotificationChannelFlags> {
  const policy = await getNotificationPolicy(organizationId);
  const row = policy.events[event] ?? DEFAULT_NOTIFICATION_CHANNEL;
  const email =
    event === "emailVerification" ? true : policy.emailMaster && row.email;
  const whatsapp =
    row.whatsapp && (await isWhatsAppSendingEnabled(organizationId));
  return { email, whatsapp };
}
