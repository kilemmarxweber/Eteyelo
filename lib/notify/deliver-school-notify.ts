/**
 * Notification école : inbox Klambo (messagerie Eteyelo) en priorité,
 * WhatsApp / gateway Desktop/Api en secours.
 */

import { prisma } from "@/lib/prisma";
import { ORG_ROLE } from "@/lib/permissions";
import { findUserByTelephone } from "@/lib/mobile/session";
import { normalizePhoneE164 } from "@/lib/mobile/phone";
import {
  isEligibleMessagingRecipient,
} from "@/lib/messaging/messaging-policy";
import {
  createConversation,
  isOrganizationMessagingEnabled,
  MessagingError,
} from "@/lib/messaging/messaging-service";
import type { WhatsAppQueueKind } from "@/lib/whatsapp-pace";
import type { MessagingLocale } from "@/lib/messaging-locale";

export type SchoolNotifyChannel = "klambo" | "whatsapp" | "none";

export type SchoolNotifyOutcome = {
  sent: boolean;
  error?: string;
  channel: SchoolNotifyChannel;
};

function isKlamboAppFirstEnabled() {
  const raw = process.env.NOTIFY_KLAMBO_APP_FIRST?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}

function resolveNotifyPhone(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  const e164 = normalizePhoneE164(phone);
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 11) return null;
  if (/^2430+$/.test(digits) || /^0+$/.test(digits)) return null;
  return e164;
}

function buildNotifyBody(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join("\n")
    .trim()
    .slice(0, 4000);
}

const SCHOOL_NOTIFY_BOT_EMAIL_PREFIX = "school-notify+";
const SCHOOL_NOTIFY_BOT_EMAIL_DOMAIN = "system.klambo.local";

function schoolNotifyBotEmail(organizationId: string) {
  // cuid-safe local part
  const local = organizationId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 48);
  return `${SCHOOL_NOTIFY_BOT_EMAIL_PREFIX}${local}@${SCHOOL_NOTIFY_BOT_EMAIL_DOMAIN}`;
}

/**
 * Expéditeur technique (bot org) — pas un humain.
 * Évite que le propriétaire soit participant de chaque alerte destinataire.
 */
async function ensureSchoolNotifySender(organizationId: string) {
  const messagingEnabled = await isOrganizationMessagingEnabled(organizationId);
  const email = schoolNotifyBotEmail(organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const botName = org?.name?.trim()
    ? `${org.name.trim()} · Notifications`
    : "École · Notifications";

  let user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      banned: true,
      role: true,
      statusUser: true,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name: botName,
        prenom: "Notifications",
        email,
        emailVerified: true,
        statusUser: true,
        role: "user",
      },
      select: {
        id: true,
        banned: true,
        role: true,
        statusUser: true,
      },
    });
  } else if (user.banned || user.statusUser === false) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { banned: false, statusUser: true, name: botName },
      select: {
        id: true,
        banned: true,
        role: true,
        statusUser: true,
      },
    });
  }

  const existingMember = await prisma.member.findFirst({
    where: { organizationId, userId: user.id },
    select: { id: true, role: true, isArchived: true },
  });

  if (!existingMember) {
    await prisma.member.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        userId: user.id,
        role: ORG_ROLE.GESTIONNAIRE,
        createdAt: new Date(),
      },
    });
  } else if (existingMember.isArchived) {
    await prisma.member.update({
      where: { id: existingMember.id },
      data: { isArchived: false },
    });
  }

  return {
    userId: user.id,
    appRole: user.role ?? "user",
    memberRole: ORG_ROLE.GESTIONNAIRE,
    memberArchived: false,
    userBanned: false,
    messagingEnabled,
  };
}

async function fallbackWhatsApp(options: {
  to: string;
  organizationId?: string | null;
  parts: Array<string | null | undefined>;
  attachments?: Array<{ url: string; filename?: string }>;
  queueKind?: WhatsAppQueueKind;
  locale?: MessagingLocale | null;
  branchId?: string | null;
}): Promise<SchoolNotifyOutcome> {
  const { sendTransactionalWhatsAppViaProvider } = await import("@/lib/zindua");
  const wa = await sendTransactionalWhatsAppViaProvider(options);
  return {
    ...wa,
    channel: wa.sent ? "whatsapp" : "none",
  };
}

/**
 * Tente l'inbox Klambo ; sinon WhatsApp via le provider configuré.
 * Pièces jointes → WhatsApp uniquement (media in-app non branché ici).
 */
export async function deliverSchoolNotify(options: {
  to: string;
  organizationId?: string | null;
  parts: Array<string | null | undefined>;
  attachments?: Array<{ url: string; filename?: string }>;
  queueKind?: WhatsAppQueueKind;
  locale?: MessagingLocale | null;
  branchId?: string | null;
}): Promise<SchoolNotifyOutcome> {
  if (!isKlamboAppFirstEnabled()) {
    return fallbackWhatsApp(options);
  }

  if (options.attachments?.length) {
    return fallbackWhatsApp(options);
  }

  const organizationId = options.organizationId?.trim() || null;
  if (!organizationId) {
    return fallbackWhatsApp(options);
  }

  const to = resolveNotifyPhone(options.to);
  if (!to) {
    return { sent: false, channel: "none", error: "Numéro invalide." };
  }

  const body = buildNotifyBody(options.parts);
  if (!body) {
    return { sent: false, channel: "none", error: "Message vide." };
  }

  try {
    const user = await findUserByTelephone(to);
    if (!user || user.banned || user.statusUser === false) {
      return fallbackWhatsApp(options);
    }

    const member = await prisma.member.findFirst({
      where: {
        organizationId,
        userId: user.id,
        isArchived: false,
      },
      select: {
        role: true,
        user: { select: { banned: true, statusUser: true } },
      },
    });

    if (
      !member ||
      !isEligibleMessagingRecipient({
        memberRole: member.role,
        userBanned: member.user.banned,
        statusUser: member.user.statusUser,
      })
    ) {
      return fallbackWhatsApp(options);
    }

    const messagingEnabled = await isOrganizationMessagingEnabled(organizationId);
    if (!messagingEnabled) {
      return fallbackWhatsApp(options);
    }

    const sender = await ensureSchoolNotifySender(organizationId);
    if (sender.userId === user.id) {
      return fallbackWhatsApp(options);
    }

    await createConversation({
      organizationId,
      actor: sender,
      recipientIds: [user.id],
      body,
    });

    // eslint-disable-next-line no-console
    console.info(
      `[deliverSchoolNotify] channel=klambo to=${to} org=${organizationId}`,
    );
    return { sent: true, channel: "klambo" };
  } catch (error) {
    const message =
      error instanceof MessagingError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Échec envoi Klambo";
    // eslint-disable-next-line no-console
    console.warn(`[deliverSchoolNotify] klambo fail → whatsapp: ${message}`);
    return fallbackWhatsApp(options);
  }
}
