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
import { branchDocumentName } from "@/lib/branch-document-name";
import { resolveReportLogoUrl } from "@/lib/reports/resolve-school-branding";
import { schoolNotifyBotEmail } from "@/lib/notify/school-notify-bot";
import { parseNotifyCard } from "@/lib/notify/notify-message-card";
import { enqueueOrSendCriticalNoticeSms } from "@/lib/notify/critical-sms";

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
  /**
   * Force un SMS critique (P3) en plus du canal principal.
   * Sinon : SMS auto si `richBody` est une carte tone `rose` (absence / critique).
   */
  smsCritical?: boolean;
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

/** SMS critique si demandé explicitement ou carte tone rose. */
function shouldAttemptCriticalSms(options: SchoolNotifyOptions): boolean {
  if (options.smsCritical === true) return true;
  const rich = options.richBody?.trim();
  if (!rich) return false;
  const card = parseNotifyCard(rich);
  return card?.tone === "rose";
}

/**
 * Best-effort : n’altère pas le résultat du canal principal (inbox / WA).
 */
async function maybeSendCriticalSms(options: SchoolNotifyOptions): Promise<void> {
  if (!shouldAttemptCriticalSms(options)) return;

  const organizationId = options.organizationId?.trim() || null;
  const to = resolveNotifyPhone(options.to);
  if (!organizationId || !to) return;

  try {
    const user = await findUserByTelephone(to);
    if (!user) {
      // eslint-disable-next-line no-console
      console.info(
        `[deliverSchoolNotify] critical-sms skipped: no user for ${to}`,
      );
      return;
    }

    const card = options.richBody?.trim()
      ? parseNotifyCard(options.richBody)
      : null;
    const title =
      card?.title?.trim() ||
      options.parts.map((p) => p?.trim()).find(Boolean) ||
      "Avis école";
    const intro = card?.intro ?? null;

    await enqueueOrSendCriticalNoticeSms({
      organizationId,
      userId: user.id,
      telephone: to,
      title,
      intro,
      lang: options.locale ?? "fr",
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[deliverSchoolNotify] critical-sms error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export { isSchoolNotifyBotEmail } from "@/lib/notify/school-notify-bot";

function botCacheKey(organizationId: string, branchId?: string | null) {
  return `${organizationId}:${branchId?.trim() || ""}`;
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
 * Expéditeur technique (bot org ou branche) — pas un humain, no-reply.
 * Cache court pour éviter N× find/create sur un lot d'absences.
 * Profil : logo rapport branche → logo org (même règle que les PDF).
 */
async function ensureSchoolNotifySender(
  organizationId: string,
  messagingEnabled: boolean,
  branchId?: string | null,
): Promise<SchoolNotifyActor> {
  const cacheKey = botCacheKey(organizationId, branchId);
  const cached = botSenderCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.actor, messagingEnabled };
  }

  const email = schoolNotifyBotEmail(organizationId, branchId);
  const trimmedBranchId = branchId?.trim() || null;

  const [org, branch, existingUser] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, logo: true },
    }),
    trimmedBranchId
      ? prisma.branch.findFirst({
          where: { id: trimmedBranchId, organizationId },
          select: { id: true, name: true, description: true, image: true },
        })
      : Promise.resolve(null),
    prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        banned: true,
        role: true,
        statusUser: true,
        name: true,
        image: true,
      },
    }),
  ]);

  const schoolLabel = branch
    ? branchDocumentName(branch) || branch.name.trim()
    : org?.name?.trim() || "";
  const botName = schoolLabel
    ? `${schoolLabel} · Notifications`
    : "École · Notifications";
  const logoUrl =
    resolveReportLogoUrl(branch?.image, org?.logo)?.trim() || null;

  let user = existingUser;
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name: botName,
        prenom: "Notifications",
        email,
        image: logoUrl,
        emailVerified: true,
        statusUser: true,
        role: "user",
      },
      select: {
        id: true,
        banned: true,
        role: true,
        statusUser: true,
        name: true,
        image: true,
      },
    });
  } else {
    const needsUpdate =
      user.banned ||
      user.statusUser === false ||
      user.name !== botName ||
      (logoUrl && user.image !== logoUrl);
    if (needsUpdate) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          banned: false,
          statusUser: true,
          name: botName,
          prenom: "Notifications",
          ...(logoUrl ? { image: logoUrl } : {}),
        },
        select: {
          id: true,
          banned: true,
          role: true,
          statusUser: true,
          name: true,
          image: true,
        },
      });
    }
  }

  let memberId: string | null = null;
  const existingMember = await prisma.member.findFirst({
    where: { organizationId, userId: user.id },
    select: { id: true, isArchived: true },
  });

  if (!existingMember) {
    const created = await prisma.member.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        userId: user.id,
        role: ORG_ROLE.GESTIONNAIRE,
        createdAt: new Date(),
      },
      select: { id: true },
    });
    memberId = created.id;
  } else {
    memberId = existingMember.id;
    if (existingMember.isArchived) {
      await prisma.member.update({
        where: { id: existingMember.id },
        data: { isArchived: false },
      });
    }
  }

  if (trimmedBranchId && memberId) {
    const existingBranchMember = await prisma.branchMember.findFirst({
      where: { branchId: trimmedBranchId, memberId },
      select: { id: true, isActive: true },
    });
    if (!existingBranchMember) {
      await prisma.branchMember.create({
        data: {
          branchId: trimmedBranchId,
          memberId,
          role: "ADMIN",
          isActive: true,
        },
      });
    } else if (!existingBranchMember.isActive) {
      await prisma.branchMember.update({
        where: { id: existingBranchMember.id },
        data: { isActive: true, deactivatedAt: null },
      });
    }
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

  botSenderCache.set(cacheKey, {
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
  // P3 SMS bridge (tone rose / smsCritical) — best-effort, ne bloque pas.
  await maybeSendCriticalSms(options);

  const organizationId = options.organizationId?.trim() || null;
  const config = await getWhatsAppRuntimeConfig(organizationId);
  const inboxOnly = isInboxProvider(config.provider);

  if (!inboxOnly) {
    return fallbackWhatsApp(options, `provider=${config.provider}`);
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

  if (options.attachments?.length) {
    // Inbox : pas de PJ — le lien PDF reste dans le corps / la carte.
    // eslint-disable-next-line no-console
    console.info(
      `[deliverSchoolNotify] inbox: PJ ignorées (${options.attachments.length}), lien dans le message to=${to}`,
    );
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
      options.branchId,
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
