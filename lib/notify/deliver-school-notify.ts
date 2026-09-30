/**
 * Notification école — canal exclusif selon Paramètres org :
 * inbox Klambo | Zindua | KlamboWhatsapp | Meta.
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
import {
  enqueueSchoolNotifyTask,
  type SchoolNotifyQueueKind,
} from "@/lib/notify/school-notify-queue";
import type { WhatsAppQueueKind } from "@/lib/whatsapp-pace";
import type { MessagingLocale } from "@/lib/messaging-locale";
import {
  getWhatsAppRuntimeConfig,
  isInboxProvider,
} from "@/lib/whatsapp-settings";

export type SchoolNotifyChannel = "klambo" | "whatsapp" | "none";

export type SchoolNotifyOutcome = {
  sent: boolean;
  error?: string;
  channel: SchoolNotifyChannel;
};

type SchoolNotifyActor = {
  userId: string;
  appRole: string;
  memberRole: string;
  memberArchived: boolean;
  userBanned: boolean;
  messagingEnabled: boolean;
  skipRateLimit?: boolean;
};

type SchoolNotifyOptions = {
  to: string;
  organizationId?: string | null;
  parts: Array<string | null | undefined>;
  /** Corps riche inbox (`__NOTIFY__:{json}`) — prioritaire sur `parts` pour Klambo. */
  richBody?: string | null;
  attachments?: Array<{ url: string; filename?: string }>;
  queueKind?: WhatsAppQueueKind;
  locale?: MessagingLocale | null;
  branchId?: string | null;
};

const BOT_CACHE_TTL_MS = 10 * 60_000;
const ORG_MSG_CACHE_TTL_MS = 60_000;

const botSenderCache = new Map<
  string,
  { actor: SchoolNotifyActor; expiresAt: number }
>();
const orgMessagingCache = new Map<
  string,
  { enabled: boolean; expiresAt: number }
>();

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
  const local = organizationId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 48);
  return `${SCHOOL_NOTIFY_BOT_EMAIL_PREFIX}${local}@${SCHOOL_NOTIFY_BOT_EMAIL_DOMAIN}`;
}

async function getMessagingEnabledCached(organizationId: string) {
  const hit = orgMessagingCache.get(organizationId);
  if (hit && hit.expiresAt > Date.now()) return hit.enabled;
  const enabled = await isOrganizationMessagingEnabled(organizationId);
  orgMessagingCache.set(organizationId, {
    enabled,
    expiresAt: Date.now() + ORG_MSG_CACHE_TTL_MS,
  });
  return enabled;
}

/**
 * Expéditeur technique (bot org) — pas un humain.
 * Cache court pour éviter N× find/create sur un lot d'absences.
 */
async function ensureSchoolNotifySender(
  organizationId: string,
  messagingEnabled: boolean,
): Promise<SchoolNotifyActor> {
  const cached = botSenderCache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.actor, messagingEnabled };
  }

  const email = schoolNotifyBotEmail(organizationId);
  const [org, existingUser] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        banned: true,
        role: true,
        statusUser: true,
      },
    }),
  ]);

  const botName = org?.name?.trim()
    ? `${org.name.trim()} · Notifications`
    : "École · Notifications";

  let user = existingUser;
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
    select: { id: true, isArchived: true },
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

  const actor: SchoolNotifyActor = {
    userId: user.id,
    appRole: user.role ?? "user",
    memberRole: ORG_ROLE.GESTIONNAIRE,
    memberArchived: false,
    userBanned: false,
    messagingEnabled,
    skipRateLimit: true,
  };

  botSenderCache.set(organizationId, {
    actor,
    expiresAt: Date.now() + BOT_CACHE_TTL_MS,
  });

  return actor;
}

async function fallbackWhatsApp(
  options: SchoolNotifyOptions,
  reason: string,
): Promise<SchoolNotifyOutcome> {
  // eslint-disable-next-line no-console
  console.info(
    `[deliverSchoolNotify] fallback→whatsapp reason=${reason} to=${options.to}`,
  );
  const { sendTransactionalWhatsAppViaProvider } = await import("@/lib/zindua");
  const wa = await sendTransactionalWhatsAppViaProvider(options);
  return {
    ...wa,
    channel: wa.sent ? "whatsapp" : "none",
  };
}

/**
 * Corps synchrone (une tentative) — appelé uniquement depuis la file.
 * Canal exclusif selon Paramètres → Message WhatsApp :
 * - inbox → messagerie Klambo seulement (pas de WhatsApp)
 * - zindua | klambo | meta → gateway WhatsApp seulement
 */
async function deliverSchoolNotifyNow(
  options: SchoolNotifyOptions,
): Promise<SchoolNotifyOutcome> {
  const organizationId = options.organizationId?.trim() || null;
  const config = await getWhatsAppRuntimeConfig(organizationId);
  const inboxOnly = isInboxProvider(config.provider);

  if (!inboxOnly) {
    return fallbackWhatsApp(options, `provider=${config.provider}`);
  }

  if (options.attachments?.length) {
    // Inbox seul : pièces jointes gateway non disponibles
    return {
      sent: false,
      channel: "none",
      error:
        "Pièces jointes indisponibles en mode Klambo Inbox (passez sur un gateway WhatsApp).",
    };
  }

  if (!organizationId) {
    return {
      sent: false,
      channel: "none",
      error: "Organisation manquante pour l’inbox Klambo.",
    };
  }

  const to = resolveNotifyPhone(options.to);
  if (!to) {
    return { sent: false, channel: "none", error: "Numéro invalide." };
  }

  const body =
    options.richBody?.trim() || buildNotifyBody(options.parts);
  if (!body) {
    return { sent: false, channel: "none", error: "Message vide." };
  }

  try {
    const [user, messagingEnabled] = await Promise.all([
      findUserByTelephone(to),
      getMessagingEnabledCached(organizationId),
    ]);

    if (!user || user.banned || user.statusUser === false) {
      return {
        sent: false,
        channel: "none",
        error: !user
          ? "Destinataire absent de Klambo (inbox)."
          : "Compte destinataire inactif.",
      };
    }

    if (!messagingEnabled) {
      return {
        sent: false,
        channel: "none",
        error: "Messagerie organisation désactivée.",
      };
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
      return {
        sent: false,
        channel: "none",
        error: !member
          ? "Destinataire hors organisation."
          : "Destinataire non éligible à l’inbox.",
      };
    }

    const sender = await ensureSchoolNotifySender(
      organizationId,
      messagingEnabled,
    );
    if (sender.userId === user.id) {
      return {
        sent: false,
        channel: "none",
        error: "Expéditeur et destinataire identiques.",
      };
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
    console.warn(`[deliverSchoolNotify] klambo fail (inbox-only): ${message}`);
    return { sent: false, channel: "none", error: message };
  }
}

/**
 * Canal exclusif (inbox Klambo | gateway WhatsApp) selon les paramètres org.
 * Toujours enfilé (round-robin par `queueKind`) pour lisser la charge.
 */
export async function deliverSchoolNotify(
  options: SchoolNotifyOptions,
): Promise<SchoolNotifyOutcome> {
  const kind = (options.queueKind ?? "other") as SchoolNotifyQueueKind;
  return enqueueSchoolNotifyTask(() => deliverSchoolNotifyNow(options), kind);
}

/** Invalide les caches bot / messagingEnabled (tests). */
export function __resetSchoolNotifyCachesForTests() {
  botSenderCache.clear();
  orgMessagingCache.clear();
}
