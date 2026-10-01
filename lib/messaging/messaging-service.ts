import { orgRoleLabel } from "@/lib/org-role-labels";
import { phoneSearchNeedle, digitsOnly } from "@/lib/mobile/phone";
import { prisma } from "@/lib/prisma";
import {
  canCreateGroup,
  canPurgeOrganizationMessaging,
  canSendMessages,
  canUseMessaging,
  isEligibleMessagingRecipient,
  messagingDeniedMessage,
} from "@/lib/messaging/messaging-policy";
import {
  formatMessagingPersonName,
  MESSAGING_CONVERSATIONS_PAGE_SIZE,
  MESSAGING_MAX_BODY_LENGTH,
  MESSAGING_MAX_GROUP_ADMINS,
  MESSAGING_MAX_RECIPIENTS,
  MESSAGING_MAX_SUBJECT_LENGTH,
  MESSAGING_MESSAGES_PAGE_SIZE,
  MESSAGING_PURGE_CONFIRMATION,
  MESSAGING_RATE_LIMIT_PER_MINUTE,
  MESSAGING_SEARCH_PAGE_SIZE,
  previewDeletedOrBody,
  previewMessageBody,
  sanitizeMessageBody,
  type ConversationContextTypeValue,
  type ConversationListItem,
  type ConversationParticipantRoleValue,
  type ConversationTypeValue,
  type MessageView,
  type MessagingFilter,
  type MessagingRecipient,
} from "@/lib/messaging/messaging-types";
import { isSchoolNotifyBotEmail } from "@/lib/notify/school-notify-bot";
import { Prisma } from "@/prisma/generated/prisma/client";

const userNameSelect = {
  id: true,
  name: true,
  prenom: true,
  postnom: true,
  image: true,
  email: true,
  banned: true,
  statusUser: true,
} as const;

/** Téléphone uniquement pour le filtre serveur — jamais renvoyé au client. */
const userSearchSelect = {
  ...userNameSelect,
  telephone: true,
} as const;

type Actor = {
  userId: string;
  appRole: string;
  memberRole: string | null;
  memberArchived: boolean;
  userBanned: boolean;
  sourceBranchId?: string | null;
  messagingEnabled?: boolean;
  /** Bot alertes école : ignore le plafond 20 msg/min. */
  skipRateLimit?: boolean;
};

export class MessagingError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "MessagingError";
    this.statusCode = statusCode;
  }
}

export async function isOrganizationMessagingEnabled(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { messagingEnabled: true },
  });
  return org?.messagingEnabled !== false;
}

function actorPolicy(actor: Actor) {
  return {
    appRole: actor.appRole,
    memberRole: actor.memberRole,
    memberArchived: actor.memberArchived,
    userBanned: actor.userBanned,
    organizationMessagingEnabled: actor.messagingEnabled,
  };
}

function assertCanUse(actor: Actor) {
  if (!canUseMessaging(actorPolicy(actor))) {
    throw new MessagingError(
      actor.messagingEnabled === false
        ? messagingDeniedMessage("disabled")
        : messagingDeniedMessage("read"),
      403,
    );
  }
}

function assertCanSend(actor: Actor) {
  if (!canSendMessages(actorPolicy(actor))) {
    throw new MessagingError(
      actor.messagingEnabled === false
        ? messagingDeniedMessage("disabled")
        : messagingDeniedMessage("send"),
      403,
    );
  }
}

function participantBranches(
  rows: Array<{ id: string; name: string }>,
) {
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

function conversationTitle(params: {
  type: ConversationTypeValue;
  subject: string | null;
  currentUserId: string;
  participants: ConversationListItem["participants"];
}) {
  if (params.type === "GROUP" && params.subject?.trim()) {
    return params.subject.trim();
  }
  const others = params.participants.filter(
    (row) => row.userId !== params.currentUserId,
  );
  if (others.length === 0) {
    return params.participants[0]?.name ?? "Conversation";
  }
  if (others.length === 1) return others[0].name;
  const names = others.slice(0, 3).map((row) => row.name);
  if (others.length > 3) names.push(`+${others.length - 3}`);
  return names.join(", ");
}

function contextHref(params: {
  organizationId: string;
  contextType: ConversationContextTypeValue | null;
  contextId: string | null;
  sourceBranchId: string | null;
}) {
  if (!params.contextType || !params.contextId) return null;
  if (params.contextType === "ABSENCE_CASE" && params.sourceBranchId) {
    return `/admin/organizations/${params.organizationId}/branches/${params.sourceBranchId}/attendance?absenceCaseId=${params.contextId}`;
  }
  return null;
}

/** Bloque les réponses humaines aux fils du bot notifications école. */
export async function assertConversationAllowsHumanReply(
  conversationId: string,
  actorUserId: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null },
    select: {
      type: true,
      repliesLocked: true,
      createdById: true,
    },
  });
  if (!conversation) {
    throw new MessagingError("Conversation introuvable.");
  }

  const peers = await prisma.conversationParticipant.findMany({
    where: { conversationId, leftAt: null },
    select: {
      userId: true,
      role: true,
      user: { select: { email: true } },
    },
  });
  const notifyBot = peers.find((p) => isSchoolNotifyBotEmail(p.user.email));
  if (notifyBot && notifyBot.userId !== actorUserId) {
    throw new MessagingError(
      "Les notifications automatiques ne permettent pas de réponse.",
    );
  }

  if (conversation.type === "GROUP" && conversation.repliesLocked) {
    const me = peers.find((p) => p.userId === actorUserId);
    if (
      !isEffectiveGroupAdmin({
        actorUserId,
        actorRole: me?.role,
        createdById: conversation.createdById,
        type: conversation.type,
        participants: peers,
      })
    ) {
      throw new MessagingError(
        "Les réponses sont verrouillées : seuls les admins du groupe peuvent écrire.",
      );
    }
  }
}

async function getGroupAdminContext(params: {
  organizationId: string;
  conversationId: string;
  actorUserId: string;
}) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: params.conversationId,
      organizationId: params.organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      createdById: true,
      repliesLocked: true,
      subject: true,
    },
  });
  if (!conversation) throw new MessagingError("Conversation introuvable.");
  if (conversation.type !== "GROUP") {
    throw new MessagingError("Cette action est réservée aux groupes.");
  }

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: params.conversationId, leftAt: null },
    select: { userId: true, role: true },
  });

  // Rétrocompat : si aucun ADMIN en base, le créateur compte comme admin.
  const hasExplicitAdmin = participants.some((p) => p.role === "ADMIN");
  const adminUserIds = new Set(
    participants
      .filter((p) =>
        isEffectiveGroupAdmin({
          actorUserId: p.userId,
          actorRole: p.role,
          createdById: conversation.createdById,
          type: conversation.type,
          participants,
        }),
      )
      .map((p) => p.userId),
  );
  if (!hasExplicitAdmin && conversation.createdById) {
    adminUserIds.add(conversation.createdById);
  }

  const isAdmin = isEffectiveGroupAdmin({
    actorUserId: params.actorUserId,
    actorRole: participants.find((p) => p.userId === params.actorUserId)?.role,
    createdById: conversation.createdById,
    type: conversation.type,
    participants,
  });
  return {
    conversation,
    participants,
    adminUserIds,
    adminCount: adminUserIds.size,
    isAdmin,
  };
}

function resolveParticipantGroupRole(params: {
  userId: string;
  role: ConversationParticipantRoleValue | string;
  createdById: string;
  type: ConversationTypeValue | string;
  hasExplicitAdmin: boolean;
}): ConversationParticipantRoleValue {
  if (params.type !== "GROUP") return "MEMBER";
  if (params.role === "ADMIN") return "ADMIN";
  if (!params.hasExplicitAdmin && params.userId === params.createdById) {
    return "ADMIN";
  }
  return "MEMBER";
}

/** Admin effectif : rôle ADMIN, ou créateur seulement s'il n'y a aucun ADMIN explicite. */
export function isEffectiveGroupAdmin(params: {
  actorUserId: string;
  actorRole: string | null | undefined;
  createdById: string | null | undefined;
  type: ConversationTypeValue | string;
  participants: Array<{ userId: string; role: string }>;
}): boolean {
  if (params.type !== "GROUP") return false;
  const hasExplicitAdmin = params.participants.some((p) => p.role === "ADMIN");
  return (
    resolveParticipantGroupRole({
      userId: params.actorUserId,
      role: params.actorRole ?? "MEMBER",
      createdById: params.createdById ?? "",
      type: params.type,
      hasExplicitAdmin,
    }) === "ADMIN"
  );
}

async function loadRecipientMap(
  organizationId: string,
  userIds: string[],
): Promise<Map<string, MessagingRecipient>> {
  if (userIds.length === 0) return new Map();
  const members = await prisma.member.findMany({
    where: { organizationId, userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      role: true,
      isArchived: true,
      user: { select: userNameSelect },
      branchMember: {
        where: { isActive: true, branch: { isActive: true } },
        select: {
          branch: { select: { id: true, name: true } },
        },
      },
    },
  });
  const map = new Map<string, MessagingRecipient>();
  for (const member of members) {
    map.set(member.userId, {
      userId: member.userId,
      memberId: member.id,
      name: formatMessagingPersonName(member.user),
      image: member.user.image,
      // Pas de téléphone en cache destinataires (évite fuite vers clients).
      telephone: null,
      prenom: member.user.prenom ?? null,
      role: member.role,
      roleLabel: orgRoleLabel(member.role.split(",")[0] ?? member.role),
      branches: participantBranches(
        member.branchMember.map((row) => row.branch),
      ),
    });
  }
  return map;
}

async function assertEligibleRecipients(
  organizationId: string,
  recipientIds: string[],
  actorUserId: string,
) {
  const unique = Array.from(new Set(recipientIds.filter(Boolean)));
  if (unique.includes(actorUserId)) {
    throw new MessagingError("Vous ne pouvez pas vous ajouter comme destinataire.");
  }
  if (unique.length === 0) {
    throw new MessagingError("Choisissez au moins un destinataire.");
  }
  if (unique.length > MESSAGING_MAX_RECIPIENTS) {
    throw new MessagingError(
      `Maximum ${MESSAGING_MAX_RECIPIENTS} destinataires.`,
    );
  }

  const members = await prisma.member.findMany({
    where: { organizationId, userId: { in: unique } },
    select: {
      userId: true,
      role: true,
      isArchived: true,
      user: { select: { banned: true, statusUser: true } },
      branchMember: { select: { role: true } },
    },
  });
  if (members.length !== unique.length) {
    throw new MessagingError(
      "Un destinataire n'appartient pas à cette organisation.",
    );
  }
  for (const member of members) {
    if (
      !isEligibleMessagingRecipient({
        memberRole: member.role,
        extraRoles: member.branchMember.map((row) => String(row.role)),
        memberArchived: member.isArchived,
        userBanned: member.user.banned,
        statusUser: member.user.statusUser,
      })
    ) {
      throw new MessagingError(
        "Un destinataire n'est plus autorisé à recevoir des messages.",
      );
    }
  }
  return unique;
}

async function getParticipantOrThrow(
  conversationId: string,
  userId: string,
  organizationId: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      organizationId,
      deletedAt: null,
    },
    include: {
      participants: {
        where: { userId, leftAt: null },
        take: 1,
      },
    },
  });
  if (!conversation) {
    throw new MessagingError("Conversation introuvable.");
  }
  const participant = conversation.participants[0];
  if (!participant) {
    throw new MessagingError("Vous n'appartenez pas à cette conversation.");
  }
  return { conversation, participant };
}

export async function searchMessagingRecipients(params: {
  organizationId: string;
  actor: Actor;
  query: string;
  cursor?: string | null;
}) {
  assertCanUse(params.actor);
  const q = params.query.trim();
  const phoneNeedle = phoneSearchNeedle(q);
  const members = await prisma.member.findMany({
    where: {
      organizationId: params.organizationId,
      isArchived: false,
      userId: { not: params.actor.userId },
    },
    select: {
      id: true,
      userId: true,
      role: true,
      user: { select: userSearchSelect },
      branchMember: {
        where: { branch: { organizationId: params.organizationId, isActive: true } },
        select: {
          role: true,
          isActive: true,
          branch: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const needle = q.toLowerCase();
  const filtered = members.filter((member) => {
    const extraRoles = member.branchMember.map((row) => String(row.role));
    if (isSchoolNotifyBotEmail(member.user.email)) {
      return false;
    }
    if (
      !isEligibleMessagingRecipient({
        memberRole: member.role,
        extraRoles,
        memberArchived: false,
        userBanned: member.user.banned,
        statusUser: member.user.statusUser,
      })
    ) {
      return false;
    }
    if (!needle) return true;
    const name = formatMessagingPersonName(member.user).toLowerCase();
    const email = (member.user.email ?? "").toLowerCase();
    const phoneDigits = digitsOnly(member.user.telephone ?? "");
    const role = orgRoleLabel(
      member.role.split(",")[0] ?? member.role,
    ).toLowerCase();
    const branches = member.branchMember
      .map((row) => row.branch.name.toLowerCase())
      .join(" ");
    const phoneHit =
      phoneNeedle != null &&
      phoneDigits.length > 0 &&
      (phoneDigits.includes(phoneNeedle) || phoneNeedle.includes(phoneDigits));
    return (
      name.includes(needle) ||
      email.includes(needle) ||
      role.includes(needle) ||
      branches.includes(needle) ||
      phoneHit ||
      (member.user.telephone ?? "").toLowerCase().includes(needle)
    );
  });

  const start = params.cursor
    ? filtered.findIndex((row) => row.userId === params.cursor) + 1
    : 0;
  const page = filtered.slice(start, start + MESSAGING_SEARCH_PAGE_SIZE);
  const items: MessagingRecipient[] = page.map((member) => ({
    userId: member.userId,
    memberId: member.id,
    name: formatMessagingPersonName(member.user),
    image: member.user.image,
    // Recherche serveur OK ; ne pas exposer le E.164 complet au client.
    telephone: null,
    prenom: member.user.prenom ?? null,
    role: member.role,
    roleLabel: orgRoleLabel(member.role.split(",")[0] ?? member.role),
    branches: participantBranches(
      member.branchMember
        .filter((row) => row.isActive)
        .map((row) => row.branch),
    ),
  }));
  const nextCursor =
    start + page.length < filtered.length
      ? page[page.length - 1]?.userId ?? null
      : null;
  return { items, nextCursor };
}

async function findDirectConversation(
  organizationId: string,
  userA: string,
  userB: string,
) {
  const mine = await prisma.conversation.findMany({
    where: {
      organizationId,
      type: "DIRECT",
      deletedAt: null,
      participants: { some: { userId: userA, leftAt: null } },
    },
    select: {
      id: true,
      participants: {
        where: { leftAt: null },
        select: { userId: true },
      },
    },
  });
  return (
    mine.find((row) => {
      const ids = row.participants.map((p) => p.userId).sort();
      return ids.length === 2 && ids[0] === [userA, userB].sort()[0] && ids[1] === [userA, userB].sort()[1];
    })?.id ?? null
  );
}

async function findContextualConversation(
  organizationId: string,
  contextType: ConversationContextTypeValue,
  contextId: string,
) {
  return prisma.conversation.findFirst({
    where: {
      organizationId,
      type: "CONTEXTUAL",
      contextType,
      contextId,
      deletedAt: null,
    },
    select: { id: true },
  });
}

async function assertAbsenceContextAccess(params: {
  organizationId: string;
  actorUserId: string;
  actorRole: string | null;
  appRole: string;
  contextId: string;
}) {
  const caseRow = await prisma.absenceCase.findFirst({
    where: {
      id: params.contextId,
      organizationId: params.organizationId,
    },
    select: {
      id: true,
      userId: true,
      branchId: true,
    },
  });
  if (!caseRow) {
    throw new MessagingError("Dossier d'absence introuvable.");
  }
  if (caseRow.userId === params.actorUserId) return caseRow;
  const reviewers = await prisma.member.findMany({
    where: {
      organizationId: params.organizationId,
      isArchived: false,
      branchMember: {
        some: { branchId: caseRow.branchId, isActive: true },
      },
    },
    select: { userId: true, role: true },
  });
  const allowed = reviewers.some(
    (row) =>
      row.userId === params.actorUserId &&
      canUseMessaging({
        appRole: params.appRole,
        memberRole: row.role,
      }),
  );
  if (!allowed) {
    throw new MessagingError(
      "Vous n'avez pas accès à ce dossier pour y répondre.",
    );
  }
  return caseRow;
}

export async function createConversation(params: {
  organizationId: string;
  actor: Actor;
  recipientIds: string[];
  body: string;
  subject?: string | null;
  clientMessageId?: string | null;
  contextType?: ConversationContextTypeValue | null;
  contextId?: string | null;
}) {
  assertCanSend(params.actor);
  const body = sanitizeMessageBody(params.body, {
    allowStructured: Boolean(params.actor.skipRateLimit),
  });
  if (!body) throw new MessagingError("Le message ne peut pas être vide.");
  if (body.length > MESSAGING_MAX_BODY_LENGTH) {
    throw new MessagingError(
      `Le message ne peut pas dépasser ${MESSAGING_MAX_BODY_LENGTH} caractères.`,
    );
  }

  let recipientIds = params.recipientIds.filter(Boolean);

  let type: ConversationTypeValue = "DIRECT";
  if (params.contextType && params.contextId) {
    type = "CONTEXTUAL";
    const caseRow = await assertAbsenceContextAccess({
      organizationId: params.organizationId,
      actorUserId: params.actor.userId,
      actorRole: params.actor.memberRole,
      appRole: params.actor.appRole,
      contextId: params.contextId,
    });
    if (caseRow.userId !== params.actor.userId && !recipientIds.includes(caseRow.userId)) {
      recipientIds = [...recipientIds, caseRow.userId];
    }
    if (recipientIds.length === 0) {
      throw new MessagingError(
        "Impossible de créer le fil : aucun correspondant sur ce dossier.",
      );
    }
    const others = recipientIds.filter((id) => id !== caseRow.userId);
    if (others.length > 0) {
      await assertEligibleRecipients(
        params.organizationId,
        others,
        params.actor.userId,
      );
    }
    const subjectMember = await prisma.member.findFirst({
      where: {
        organizationId: params.organizationId,
        userId: caseRow.userId,
        isArchived: false,
      },
      select: { user: { select: { banned: true } } },
    });
    if (caseRow.userId !== params.actor.userId) {
      if (!subjectMember || subjectMember.user.banned) {
        throw new MessagingError(
          "Le destinataire de ce dossier n'est plus joignable.",
        );
      }
    }
  } else {
    recipientIds = await assertEligibleRecipients(
      params.organizationId,
      recipientIds,
      params.actor.userId,
    );
    if (recipientIds.length >= 2) {
      if (!canCreateGroup(actorPolicy(params.actor))) {
        throw new MessagingError(messagingDeniedMessage("group"));
      }
      type = "GROUP";
    }
  }

  if (params.clientMessageId) {
    const existing = await prisma.message.findFirst({
      where: {
        senderId: params.actor.userId,
        clientMessageId: params.clientMessageId,
      },
      select: { conversationId: true },
    });
    if (existing) {
      return { conversationId: existing.conversationId, reused: true };
    }
  }

  let conversationId: string | null = null;
  if (type === "DIRECT") {
    conversationId = await findDirectConversation(
      params.organizationId,
      params.actor.userId,
      recipientIds[0],
    );
  } else if (type === "CONTEXTUAL" && params.contextType && params.contextId) {
    const existing = await findContextualConversation(
      params.organizationId,
      params.contextType,
      params.contextId,
    );
    conversationId = existing?.id ?? null;
  }

  if (conversationId) {
    await sendMessage({
      organizationId: params.organizationId,
      actor: params.actor,
      conversationId,
      body,
      clientMessageId: params.clientMessageId,
    });
    return { conversationId, reused: true };
  }

  const participantIds = Array.from(
    new Set([params.actor.userId, ...recipientIds]),
  );

  const created = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        organizationId: params.organizationId,
        type,
        subject: type === "GROUP" ? params.subject?.trim() || null : null,
        createdById: params.actor.userId,
        sourceBranchId: params.actor.sourceBranchId ?? null,
        contextType: type === "CONTEXTUAL" ? params.contextType : null,
        contextId: type === "CONTEXTUAL" ? params.contextId : null,
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            role:
              type === "GROUP" && userId === params.actor.userId
                ? "ADMIN"
                : "MEMBER",
            lastReadAt: userId === params.actor.userId ? new Date() : null,
          })),
        },
      },
      select: { id: true },
    });

    const message = await insertMessageAndNotify(tx, {
      organizationId: params.organizationId,
      conversationId: conversation.id,
      senderId: params.actor.userId,
      body,
      clientMessageId: params.clientMessageId,
      sourceBranchId: params.actor.sourceBranchId ?? null,
      skipRateLimit: params.actor.skipRateLimit,
    });

    return { conversationId: conversation.id, messageId: message.id };
  });

  void import("@/lib/mobile/realtime").then(async ({ publishMobileEvent }) => {
    const sender = await prisma.user.findUnique({
      where: { id: params.actor.userId },
      select: { name: true, prenom: true },
    });
    const senderName =
      [sender?.prenom, sender?.name].filter(Boolean).join(" ") || "Klambo";
    return publishMobileEvent({
      type: "message.created",
      organizationId: params.organizationId,
      conversationId: created.conversationId,
      messageId: created.messageId,
      senderId: params.actor.userId,
      recipientUserIds: participantIds.filter((id) => id !== params.actor.userId),
      bodyPreview: body.slice(0, 160),
      senderName,
    });
  });

  return { conversationId: created.conversationId, reused: false };
}

export async function createGroup(params: {
  organizationId: string;
  actor: Actor;
  recipientIds: string[];
  subject: string;
  body?: string | null;
  clientMessageId?: string | null;
}) {
  assertCanSend(params.actor);
  if (!canCreateGroup(actorPolicy(params.actor))) {
    throw new MessagingError(messagingDeniedMessage("group"));
  }

  const subject = params.subject.trim().slice(0, MESSAGING_MAX_SUBJECT_LENGTH);
  if (!subject) {
    throw new MessagingError("Le nom du groupe est obligatoire.");
  }

  const recipientIds = await assertEligibleRecipients(
    params.organizationId,
    params.recipientIds,
    params.actor.userId,
  );

  const body = params.body
    ? sanitizeMessageBody(params.body, {
        allowStructured: Boolean(params.actor.skipRateLimit),
      })
    : "";
  if (body.length > MESSAGING_MAX_BODY_LENGTH) {
    throw new MessagingError(
      `Le message ne peut pas dépasser ${MESSAGING_MAX_BODY_LENGTH} caractères.`,
    );
  }

  if (params.clientMessageId) {
    const existing = await prisma.message.findFirst({
      where: {
        senderId: params.actor.userId,
        clientMessageId: params.clientMessageId,
      },
      select: { conversationId: true },
    });
    if (existing) {
      return { conversationId: existing.conversationId, reused: true };
    }
  }

  const participantIds = Array.from(
    new Set([params.actor.userId, ...recipientIds]),
  );

  const created = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        organizationId: params.organizationId,
        type: "GROUP",
        subject,
        createdById: params.actor.userId,
        sourceBranchId: params.actor.sourceBranchId ?? null,
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            role: userId === params.actor.userId ? "ADMIN" : "MEMBER",
            lastReadAt: userId === params.actor.userId ? new Date() : null,
          })),
        },
      },
      select: { id: true },
    });

    if (body) {
      await insertMessageAndNotify(tx, {
        organizationId: params.organizationId,
        conversationId: conversation.id,
        senderId: params.actor.userId,
        body,
        clientMessageId: params.clientMessageId,
        sourceBranchId: params.actor.sourceBranchId ?? null,
      });
    } else {
      const sender = await tx.user.findUnique({
        where: { id: params.actor.userId },
        select: userNameSelect,
      });
      const senderName = formatMessagingPersonName(sender);
      const href = `/admin/organizations/${params.organizationId}/messagerie?c=${conversation.id}`;
      const recipients = participantIds.filter(
        (userId) => userId !== params.actor.userId,
      );
      for (const userId of recipients) {
        await tx.appNotification.create({
          data: {
            organizationId: params.organizationId,
            branchId: params.actor.sourceBranchId ?? null,
            userId,
            type: "MESSAGE",
            title: subject,
            body: `${senderName} vous a ajouté au groupe.`,
            href,
            conversationId: conversation.id,
          },
        });
      }
    }

    return conversation.id;
  });

  return { conversationId: created, reused: false };
}

async function insertMessageAndNotify(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    conversationId: string;
    senderId: string;
    body: string;
    clientMessageId?: string | null;
    replyToId?: string | null;
    sourceBranchId?: string | null;
    /** Alertes école (bot) : pas de plafond humain 20/min. */
    skipRateLimit?: boolean;
  },
) {
  if (!params.skipRateLimit) {
    const recent = await tx.message.count({
      where: {
        senderId: params.senderId,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recent >= MESSAGING_RATE_LIMIT_PER_MINUTE) {
      throw new MessagingError(
        "Trop de messages envoyés. Réessayez dans une minute.",
      );
    }
  }

  const sender = await tx.user.findUnique({
    where: { id: params.senderId },
    select: userNameSelect,
  });
  const senderName = formatMessagingPersonName(sender);

  const message = await tx.message.create({
    data: {
      conversationId: params.conversationId,
      senderId: params.senderId,
      body: params.body,
      replyToId: params.replyToId ?? null,
      clientMessageId: params.clientMessageId || null,
    },
  });

  await tx.conversation.update({
    where: { id: params.conversationId },
    data: { updatedAt: new Date() },
  });

  await tx.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.senderId,
      },
    },
    data: { lastReadAt: new Date(), archivedAt: null },
  });

  const recipients = await tx.conversationParticipant.findMany({
    where: {
      conversationId: params.conversationId,
      leftAt: null,
      userId: { not: params.senderId },
    },
    select: { userId: true, mutedAt: true },
  });

  await tx.conversationParticipant.updateMany({
    where: {
      conversationId: params.conversationId,
      userId: { in: recipients.map((row) => row.userId) },
    },
    data: { archivedAt: null },
  });

  const href = `/admin/organizations/${params.organizationId}/messagerie?c=${params.conversationId}`;
  const preview = previewMessageBody(params.body, 90);

  for (const recipient of recipients) {
    if (recipient.mutedAt) continue;
    const existing = await tx.appNotification.findFirst({
      where: { messageId: message.id, userId: recipient.userId },
      select: { id: true },
    });
    if (existing) continue;
    await tx.appNotification.create({
      data: {
        organizationId: params.organizationId,
        branchId: params.sourceBranchId ?? null,
        userId: recipient.userId,
        type: "MESSAGE",
        title: senderName,
        body: preview,
        href,
        conversationId: params.conversationId,
        messageId: message.id,
      },
    });
  }

  return message;
}

export async function sendMessage(params: {
  organizationId: string;
  actor: Actor;
  conversationId: string;
  body: string;
  replyToId?: string | null;
  clientMessageId?: string | null;
}) {
  assertCanSend(params.actor);
  const body = sanitizeMessageBody(params.body, {
    allowStructured: Boolean(params.actor.skipRateLimit),
  });
  if (!body) throw new MessagingError("Le message ne peut pas être vide.");
  if (body.length > MESSAGING_MAX_BODY_LENGTH) {
    throw new MessagingError(
      `Le message ne peut pas dépasser ${MESSAGING_MAX_BODY_LENGTH} caractères.`,
    );
  }

  await getParticipantOrThrow(
    params.conversationId,
    params.actor.userId,
    params.organizationId,
  );
  await assertConversationAllowsHumanReply(
    params.conversationId,
    params.actor.userId,
  );

  if (params.clientMessageId) {
    const existing = await prisma.message.findFirst({
      where: {
        senderId: params.actor.userId,
        clientMessageId: params.clientMessageId,
      },
      select: { id: true, conversationId: true },
    });
    if (existing) {
      return { messageId: existing.id, conversationId: existing.conversationId, reused: true };
    }
  }

  if (params.replyToId) {
    const reply = await prisma.message.findFirst({
      where: {
        id: params.replyToId,
        conversationId: params.conversationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!reply) throw new MessagingError("Message cité introuvable.");
  }

  const message = await prisma.$transaction((tx) =>
    insertMessageAndNotify(tx, {
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      senderId: params.actor.userId,
      body,
      clientMessageId: params.clientMessageId,
      replyToId: params.replyToId,
      sourceBranchId: params.actor.sourceBranchId ?? null,
      skipRateLimit: params.actor.skipRateLimit,
    }),
  );

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: params.conversationId, leftAt: null },
    select: { userId: true },
  });
  void import("@/lib/mobile/realtime").then(async ({ publishMobileEvent }) => {
    const sender = await prisma.user.findUnique({
      where: { id: params.actor.userId },
      select: { name: true, prenom: true },
    });
    const senderName =
      [sender?.prenom, sender?.name].filter(Boolean).join(" ") || "Klambo";
    return publishMobileEvent({
      type: "message.created",
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      messageId: message.id,
      senderId: params.actor.userId,
      recipientUserIds: participants
        .map((p) => p.userId)
        .filter((id) => id !== params.actor.userId),
      bodyPreview: body.slice(0, 160),
      senderName,
    });
  });

  return { messageId: message.id, conversationId: params.conversationId, reused: false };
}

async function publishMessageLifecycle(params: {
  type: "message.updated" | "message.deleted" | "message.created";
  organizationId: string;
  conversationId: string;
  messageId: string;
  senderId: string;
  bodyPreview?: string | null;
  senderName?: string | null;
}) {
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: params.conversationId, leftAt: null },
    select: { userId: true },
  });
  const recipientUserIds = participants
    .map((p) => p.userId)
    .filter((id) => id !== params.senderId);
  void import("@/lib/mobile/realtime").then(({ publishMobileEvent }) =>
    publishMobileEvent({
      type: params.type,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      senderId: params.senderId,
      recipientUserIds,
      ...(params.type === "message.created"
        ? {
            bodyPreview: params.bodyPreview ?? null,
            senderName: params.senderName ?? null,
          }
        : {}),
    }),
  );
}

export async function editMessage(params: {
  organizationId: string;
  actor: Actor;
  messageId: string;
  body: string;
  /** Si fourni, doit correspondre à la conversation du message. */
  conversationId?: string | null;
}) {
  assertCanSend(params.actor);
  // Édition client uniquement — jamais de payload structuré injecté.
  const body = sanitizeMessageBody(params.body, { allowStructured: false });
  if (!body) throw new MessagingError("Le message ne peut pas être vide.");
  if (body.length > MESSAGING_MAX_BODY_LENGTH) {
    throw new MessagingError(
      `Le message ne peut pas dépasser ${MESSAGING_MAX_BODY_LENGTH} caractères.`,
    );
  }

  const message = await prisma.message.findFirst({
    where: { id: params.messageId, deletedAt: null },
    select: {
      id: true,
      body: true,
      conversationId: true,
      senderId: true,
      conversation: { select: { organizationId: true } },
    },
  });
  if (!message || message.conversation.organizationId !== params.organizationId) {
    throw new MessagingError("Message introuvable.");
  }
  if (
    params.conversationId &&
    params.conversationId !== message.conversationId
  ) {
    throw new MessagingError("Message hors conversation.");
  }
  if (message.senderId !== params.actor.userId) {
    throw new MessagingError("Vous ne pouvez modifier que vos propres messages.");
  }
  if (message.body.startsWith("__CALL__:")) {
    throw new MessagingError("Ce message système ne peut pas être modifié.");
  }
  if (
    message.body.startsWith("__NOTIFY__:") ||
    message.body.startsWith("__SATISFACTION__:")
  ) {
    throw new MessagingError("Ce message système ne peut pas être modifié.");
  }
  await getParticipantOrThrow(
    message.conversationId,
    params.actor.userId,
    params.organizationId,
  );

  await prisma.message.update({
    where: { id: message.id },
    data: { body, editedAt: new Date() },
  });
  await prisma.conversation.update({
    where: { id: message.conversationId },
    data: { updatedAt: new Date() },
  });

  await publishMessageLifecycle({
    type: "message.updated",
    organizationId: params.organizationId,
    conversationId: message.conversationId,
    messageId: message.id,
    senderId: params.actor.userId,
  });

  return {
    messageId: message.id,
    conversationId: message.conversationId,
    body,
  };
}

export async function deleteMessage(params: {
  organizationId: string;
  actor: Actor;
  messageId: string;
  conversationId?: string | null;
}) {
  assertCanSend(params.actor);
  const message = await prisma.message.findFirst({
    where: { id: params.messageId, deletedAt: null },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      conversation: {
        select: {
          organizationId: true,
          type: true,
          createdById: true,
        },
      },
    },
  });
  if (!message || message.conversation.organizationId !== params.organizationId) {
    throw new MessagingError("Message introuvable.");
  }
  if (
    params.conversationId &&
    params.conversationId !== message.conversationId
  ) {
    throw new MessagingError("Message hors conversation.");
  }

  const isOwn = message.senderId === params.actor.userId;
  let isGroupAdmin = false;
  if (!isOwn && message.conversation.type === "GROUP") {
    const ctx = await getGroupAdminContext({
      organizationId: params.organizationId,
      conversationId: message.conversationId,
      actorUserId: params.actor.userId,
    });
    isGroupAdmin = ctx.isAdmin;
  }
  if (!isOwn && !isGroupAdmin) {
    throw new MessagingError(
      "Vous ne pouvez supprimer que vos propres messages (ou ceux du groupe si vous êtes admin).",
    );
  }
  await getParticipantOrThrow(
    message.conversationId,
    params.actor.userId,
    params.organizationId,
  );

  // Soft-delete : on conserve la place dans le fil, on retire le contenu
  // (texte + pièces jointes) pour que l'autre voie « message retiré ».
  await prisma.$transaction(async (tx) => {
    await tx.messageAttachment.deleteMany({ where: { messageId: message.id } });
    await tx.message.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), body: "", editedAt: null },
    });
    await tx.conversation.update({
      where: { id: message.conversationId },
      data: { updatedAt: new Date() },
    });
  });

  await publishMessageLifecycle({
    type: "message.deleted",
    organizationId: params.organizationId,
    conversationId: message.conversationId,
    messageId: message.id,
    senderId: params.actor.userId,
  });

  return {
    messageId: message.id,
    conversationId: message.conversationId,
    deletedAt: new Date().toISOString(),
  };
}

/** Trace d'appel dans le fil (style WhatsApp), idempotente par callId. */
export async function appendCallTraceMessage(params: {
  organizationId: string;
  conversationId: string;
  actorUserId: string;
  callId: string;
  kind: "AUDIO" | "VIDEO";
  status: string;
  endReason?: string | null;
  durationMs?: number;
}) {
  const clientMessageId = `call:${params.callId}`;
  const existing = await prisma.message.findFirst({
    where: { clientMessageId },
    select: { id: true, conversationId: true },
  });
  if (existing) {
    return {
      messageId: existing.id,
      conversationId: existing.conversationId,
      reused: true,
    };
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: params.conversationId,
      organizationId: params.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!conversation) {
    return { messageId: null, conversationId: null, reused: false };
  }

  const body = `__CALL__:${JSON.stringify({
    kind: params.kind,
    status: params.status,
    endReason: params.endReason ?? null,
    durationMs: Math.max(0, params.durationMs ?? 0),
    callId: params.callId,
  })}`;

  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      senderId: params.actorUserId,
      body,
      clientMessageId,
    },
  });
  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { updatedAt: new Date() },
  });

  await publishMessageLifecycle({
    type: "message.created",
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    messageId: message.id,
    senderId: params.actorUserId,
    bodyPreview: body.startsWith("__CALL__:") ? "Appel" : body.slice(0, 160),
    senderName: "Klambo",
  });

  return {
    messageId: message.id,
    conversationId: params.conversationId,
    reused: false,
  };
}

export async function listMyConversations(params: {
  organizationId: string;
  actor: Actor;
  filter: MessagingFilter;
  query?: string;
  cursor?: string | null;
}) {
  assertCanUse(params.actor);
  const archived = params.filter === "archived";
  const rows = await prisma.conversation.findMany({
    where: {
      organizationId: params.organizationId,
      deletedAt: null,
      participants: {
        some: {
          userId: params.actor.userId,
          leftAt: null,
          archivedAt: archived ? { not: null } : null,
        },
      },
      ...(params.filter === "groups" ? { type: "GROUP" } : {}),
      ...(params.filter === "direct" ? { type: "DIRECT" } : {}),
    },
    include: {
      participants: {
        where: { leftAt: null },
        include: { user: { select: userNameSelect } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: userNameSelect } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });

  const recipientMap = await loadRecipientMap(
    params.organizationId,
    Array.from(new Set(rows.flatMap((row) => row.participants.map((p) => p.userId)))),
  );

  const unreadByConversation = await countUnreadMessagesByConversation({
    userId: params.actor.userId,
    conversationIds: rows.map((row) => row.id),
  });

  // Identifiants de contexte (ex. dossier d'absence) : staff uniquement,
  // même droit que la création de groupe. Parents et autres membres
  // voient la conversation, pas contextType / contextId / le lien admin.
  const canSeeAdminContext = canCreateGroup(actorPolicy(params.actor));

  const items: ConversationListItem[] = [];
  for (const row of rows) {
    const me = row.participants.find((p) => p.userId === params.actor.userId);
    if (!me) continue;
    const last = row.messages[0];
    const unreadCount = unreadByConversation.get(row.id) ?? 0;

    const participants = row.participants.map((p) => {
      const mapped = recipientMap.get(p.userId);
      const hasExplicitAdmin = row.participants.some(
        (x) => x.role === "ADMIN",
      );
      const groupRole = resolveParticipantGroupRole({
        userId: p.userId,
        role: p.role,
        createdById: row.createdById,
        type: row.type,
        hasExplicitAdmin,
      });
      return {
        userId: p.userId,
        name: mapped?.name ?? formatMessagingPersonName(p.user),
        image: mapped?.image ?? p.user.image,
        telephone: null,
        prenom: mapped?.prenom ?? p.user.prenom ?? null,
        roleLabel: mapped?.roleLabel ?? "",
        groupRole: row.type === "GROUP" ? groupRole : undefined,
        branches: mapped?.branches ?? [],
      };
    });

    const noReply = row.participants.some(
      (p) =>
        p.userId !== params.actor.userId &&
        isSchoolNotifyBotEmail(p.user.email),
    );

    const hasExplicitAdmin = row.participants.some((p) => p.role === "ADMIN");
    const myGroupRole =
      row.type === "GROUP"
        ? resolveParticipantGroupRole({
            userId: params.actor.userId,
            role: me.role,
            createdById: row.createdById,
            type: row.type,
            hasExplicitAdmin,
          })
        : null;
    const adminCount =
      row.type === "GROUP"
        ? participants.filter((p) => p.groupRole === "ADMIN").length
        : 0;

    const item: ConversationListItem = {
      id: row.id,
      type: row.type,
      subject: row.subject,
      contextType: canSeeAdminContext ? row.contextType : null,
      contextId: canSeeAdminContext ? row.contextId : null,
      contextHref: canSeeAdminContext
        ? contextHref({
            organizationId: params.organizationId,
            contextType: row.contextType,
            contextId: row.contextId,
            sourceBranchId: row.sourceBranchId,
          })
        : null,
      updatedAt: row.updatedAt.toISOString(),
      lastMessage: last
        ? {
            id: last.id,
            body: previewDeletedOrBody(last.body, last.deletedAt, 120),
            senderId: last.senderId,
            senderName: formatMessagingPersonName(last.sender),
            createdAt: last.createdAt.toISOString(),
          }
        : null,
      unreadCount,
      archived: Boolean(me.archivedAt),
      muted: Boolean(me.mutedAt),
      noReply,
      repliesLocked: Boolean(row.repliesLocked),
      myRole: myGroupRole,
      adminCount,
      participants,
      title: conversationTitle({
        type: row.type,
        subject: row.subject,
        currentUserId: params.actor.userId,
        participants,
      }),
    };

    if (params.filter === "unread" && item.unreadCount === 0) continue;
    const q = params.query?.trim().toLowerCase();
    if (q) {
      const hay = [
        item.title,
        item.lastMessage?.body ?? "",
        ...item.participants.flatMap((p) => [
          p.name,
          p.roleLabel,
          ...p.branches.map((b) => b.name),
        ]),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }
    items.push(item);
  }

  const start = params.cursor
    ? items.findIndex((row) => row.id === params.cursor) + 1
    : 0;
  const page = items.slice(start, start + MESSAGING_CONVERSATIONS_PAGE_SIZE);
  const unreadConversations = items.filter(
    (row) => !row.archived && row.unreadCount > 0,
  ).length;
  const unreadMessages = items
    .filter((row) => !row.archived)
    .reduce((sum, row) => sum + row.unreadCount, 0);
  return {
    items: page,
    nextCursor:
      start + page.length < items.length ? page[page.length - 1]?.id ?? null : null,
    unreadConversations,
    unreadMessages,
  };
}

export async function getConversationMessages(params: {
  organizationId: string;
  actor: Actor;
  conversationId: string;
  cursor?: string | null;
}) {
  assertCanUse(params.actor);
  await getParticipantOrThrow(
    params.conversationId,
    params.actor.userId,
    params.organizationId,
  );

  const rows = await prisma.message.findMany({
    where: {
      conversationId: params.conversationId,
      // Inclure les messages soft-deleted pour afficher la trace « retiré ».
      ...(params.cursor ? { createdAt: { lt: new Date(params.cursor) } } : {}),
    },
    include: {
      sender: { select: userNameSelect },
      replyTo: {
        select: {
          id: true,
          body: true,
          deletedAt: true,
          sender: { select: userNameSelect },
        },
      },
      attachments: {
        select: {
          id: true,
          kind: true,
          url: true,
          mimeType: true,
          sizeBytes: true,
          durationMs: true,
          fileName: true,
        },
      },
      archives: {
        where: { userId: params.actor.userId },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: MESSAGING_MESSAGES_PAGE_SIZE,
  });

  const recipientMap = await loadRecipientMap(
    params.organizationId,
    Array.from(new Set(rows.map((row) => row.senderId))),
  );

  const items: MessageView[] = rows
    .slice()
    .reverse()
    .map((row) => {
      const mapped = recipientMap.get(row.senderId);
      const isDeleted = row.deletedAt != null;
      return {
        id: row.id,
        conversationId: row.conversationId,
        senderId: row.senderId,
        senderName: mapped?.name ?? formatMessagingPersonName(row.sender),
        senderImage: mapped?.image ?? row.sender.image,
        senderRoleLabel: mapped?.roleLabel ?? "",
        senderBranches: mapped?.branches ?? [],
        body: isDeleted ? "" : row.body,
        replyTo: row.replyTo
          ? {
              id: row.replyTo.id,
              senderName: formatMessagingPersonName(row.replyTo.sender),
              body: row.replyTo.deletedAt ? "" : row.replyTo.body,
              deletedAt: row.replyTo.deletedAt
                ? row.replyTo.deletedAt.toISOString()
                : null,
            }
          : null,
        attachments: isDeleted
          ? []
          : row.attachments.map((att) => ({
              id: att.id,
              kind: att.kind,
              url: att.url,
              mimeType: att.mimeType,
              sizeBytes: att.sizeBytes,
              durationMs: att.durationMs,
              fileName: att.fileName,
            })),
        createdAt: row.createdAt.toISOString(),
        editedAt:
          !isDeleted && "editedAt" in row && row.editedAt instanceof Date
            ? row.editedAt.toISOString()
            : null,
        deletedAt: isDeleted ? row.deletedAt!.toISOString() : null,
        archivedForMe: row.archives.length > 0,
      };
    });

  const conversationMeta = await prisma.conversation.findFirst({
    where: { id: params.conversationId, deletedAt: null },
    select: {
      type: true,
      createdById: true,
      repliesLocked: true,
      subject: true,
    },
  });

  const conversationPeers = await prisma.conversationParticipant.findMany({
    where: { conversationId: params.conversationId, leftAt: null },
    select: {
      userId: true,
      role: true,
      lastReadAt: true,
      user: { select: { email: true } },
    },
  });
  const noReply = conversationPeers.some(
    (p) =>
      p.userId !== params.actor.userId &&
      isSchoolNotifyBotEmail(p.user.email),
  );

  /** Watermark lecture des autres participants (✓✓ si createdAt ≤ peerLastReadAt). */
  const otherPeers = conversationPeers.filter(
    (p) => p.userId !== params.actor.userId,
  );
  let peerLastReadAt: string | null = null;
  if (
    otherPeers.length > 0 &&
    otherPeers.every((p) => p.lastReadAt != null)
  ) {
    const earliest = otherPeers.reduce((min, p) => {
      const t = p.lastReadAt!.getTime();
      return t < min.getTime() ? p.lastReadAt! : min;
    }, otherPeers[0]!.lastReadAt!);
    peerLastReadAt = earliest.toISOString();
  }

  const hasExplicitAdmin = conversationPeers.some((p) => p.role === "ADMIN");
  const myRole =
    conversationMeta?.type === "GROUP"
      ? resolveParticipantGroupRole({
          userId: params.actor.userId,
          role:
            conversationPeers.find((p) => p.userId === params.actor.userId)
              ?.role ?? "MEMBER",
          createdById: conversationMeta.createdById,
          type: conversationMeta.type,
          hasExplicitAdmin,
        })
      : null;
  const adminCount =
    conversationMeta?.type === "GROUP"
      ? conversationPeers.filter((p) =>
          resolveParticipantGroupRole({
            userId: p.userId,
            role: p.role,
            createdById: conversationMeta.createdById,
            type: conversationMeta.type,
            hasExplicitAdmin,
          }) === "ADMIN",
        ).length
      : 0;

  return {
    items,
    noReply,
    peerLastReadAt,
    repliesLocked: Boolean(conversationMeta?.repliesLocked),
    myRole,
    adminCount,
    conversationType: conversationMeta?.type ?? null,
    subject: conversationMeta?.subject ?? null,
    nextCursor:
      rows.length === MESSAGING_MESSAGES_PAGE_SIZE
        ? rows[rows.length - 1]?.createdAt.toISOString() ?? null
        : null,
  };
}

export async function markConversationRead(params: {
  organizationId: string;
  actor: Actor;
  conversationId: string;
}) {
  assertCanUse(params.actor);
  await getParticipantOrThrow(
    params.conversationId,
    params.actor.userId,
    params.organizationId,
  );
  const lastReadAt = new Date();
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.actor.userId,
      },
    },
    data: { lastReadAt },
  });
  await prisma.appNotification.updateMany({
    where: {
      conversationId: params.conversationId,
      userId: params.actor.userId,
      readAt: null,
    },
    data: { readAt: lastReadAt },
  });

  const others = await prisma.conversationParticipant.findMany({
    where: {
      conversationId: params.conversationId,
      leftAt: null,
      userId: { not: params.actor.userId },
    },
    select: { userId: true },
  });
  const recipientUserIds = others.map((p) => p.userId);
  if (recipientUserIds.length > 0) {
    void import("@/lib/mobile/realtime").then(({ publishMobileEvent }) =>
      publishMobileEvent({
        type: "conversation.updated",
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        recipientUserIds,
        userId: params.actor.userId,
        lastReadAt: lastReadAt.toISOString(),
        reason: "read",
      }),
    );
  }
}

/** Marque la conversation comme non lue (réinitialise lastReadAt). */
export async function markConversationUnread(params: {
  organizationId: string;
  actor: Actor;
  conversationId: string;
}) {
  assertCanUse(params.actor);
  await getParticipantOrThrow(
    params.conversationId,
    params.actor.userId,
    params.organizationId,
  );
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.actor.userId,
      },
    },
    data: { lastReadAt: null },
  });
}

/** Verrouille / déverrouille les réponses dans un groupe (admins only). */
export async function setGroupRepliesLocked(params: {
  organizationId: string;
  actor: Actor;
  conversationId: string;
  locked: boolean;
}) {
  assertCanSend(params.actor);
  const ctx = await getGroupAdminContext({
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    actorUserId: params.actor.userId,
  });
  if (!ctx.isAdmin) {
    throw new MessagingError("Seuls les admins du groupe peuvent modifier ce réglage.");
  }
  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { repliesLocked: params.locked, updatedAt: new Date() },
  });
  return {
    conversationId: params.conversationId,
    repliesLocked: params.locked,
  };
}

/**
 * Promouvoir / rétrograder un membre (max 5 admins).
 * Le créateur peut toujours rester admin ; on ne peut pas rétrograder le dernier admin.
 */
export async function setGroupParticipantRole(params: {
  organizationId: string;
  actor: Actor;
  conversationId: string;
  targetUserId: string;
  role: ConversationParticipantRoleValue;
}) {
  assertCanSend(params.actor);
  const ctx = await getGroupAdminContext({
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    actorUserId: params.actor.userId,
  });
  if (!ctx.isAdmin) {
    throw new MessagingError("Seuls les admins du groupe peuvent gérer les rôles.");
  }

  const target = ctx.participants.find((p) => p.userId === params.targetUserId);
  if (!target) {
    throw new MessagingError("Membre introuvable dans ce groupe.");
  }

  const nextRole = params.role === "ADMIN" ? "ADMIN" : "MEMBER";
  const currentlyAdmin = ctx.adminUserIds.has(params.targetUserId);

  if (nextRole === "ADMIN" && !currentlyAdmin) {
    if (ctx.adminCount >= MESSAGING_MAX_GROUP_ADMINS) {
      throw new MessagingError(
        `Maximum ${MESSAGING_MAX_GROUP_ADMINS} admins par groupe.`,
      );
    }
  }

  if (nextRole === "MEMBER" && currentlyAdmin) {
    if (ctx.adminCount <= 1) {
      throw new MessagingError(
        "Impossible de retirer le dernier admin du groupe.",
      );
    }
  }

  // Matérialise le créateur en ADMIN si besoin avant de promouvoir d'autres.
  if (!ctx.participants.some((p) => p.role === "ADMIN")) {
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId: params.conversationId,
        userId: ctx.conversation.createdById,
        leftAt: null,
      },
      data: { role: "ADMIN" },
    });
  }

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.targetUserId,
      },
    },
    data: { role: nextRole },
  });

  return {
    conversationId: params.conversationId,
    userId: params.targetUserId,
    role: nextRole,
  };
}

export async function getGroupSettings(params: {
  organizationId: string;
  actor: Actor;
  conversationId: string;
}) {
  assertCanUse(params.actor);
  await getParticipantOrThrow(
    params.conversationId,
    params.actor.userId,
    params.organizationId,
  );
  const ctx = await getGroupAdminContext({
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    actorUserId: params.actor.userId,
  });

  const recipientMap = await loadRecipientMap(
    params.organizationId,
    ctx.participants.map((p) => p.userId),
  );

  const hasExplicitAdmin = ctx.participants.some((p) => p.role === "ADMIN");
  const members = ctx.participants.map((p) => {
    const mapped = recipientMap.get(p.userId);
    const groupRole = resolveParticipantGroupRole({
      userId: p.userId,
      role: p.role,
      createdById: ctx.conversation.createdById,
      type: "GROUP",
      hasExplicitAdmin,
    });
    return {
      userId: p.userId,
      name: mapped?.name ?? "Membre",
      image: mapped?.image ?? null,
      telephone: null,
      roleLabel: mapped?.roleLabel ?? "",
      groupRole,
      isCreator: p.userId === ctx.conversation.createdById,
    };
  });

  members.sort((a, b) => {
    if (a.groupRole !== b.groupRole) {
      return a.groupRole === "ADMIN" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "fr");
  });

  return {
    conversationId: params.conversationId,
    subject: ctx.conversation.subject,
    repliesLocked: Boolean(ctx.conversation.repliesLocked),
    myRole: ctx.isAdmin ? ("ADMIN" as const) : ("MEMBER" as const),
    adminCount: ctx.adminCount,
    maxAdmins: MESSAGING_MAX_GROUP_ADMINS,
    members,
  };
}

export async function setConversationArchived(params: {
  organizationId: string;
  actor: Actor;
  conversationId: string;
  archived: boolean;
}) {
  assertCanUse(params.actor);
  await getParticipantOrThrow(
    params.conversationId,
    params.actor.userId,
    params.organizationId,
  );
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.actor.userId,
      },
    },
    data: { archivedAt: params.archived ? new Date() : null },
  });
}

export async function setMessageArchived(params: {
  organizationId: string;
  actor: Actor;
  messageId: string;
  archived: boolean;
}) {
  assertCanUse(params.actor);
  const message = await prisma.message.findFirst({
    where: { id: params.messageId, deletedAt: null },
    select: { id: true, conversationId: true },
  });
  if (!message) throw new MessagingError("Message introuvable.");
  await getParticipantOrThrow(
    message.conversationId,
    params.actor.userId,
    params.organizationId,
  );

  if (params.archived) {
    await prisma.userMessageArchive.upsert({
      where: {
        userId_messageId: {
          userId: params.actor.userId,
          messageId: params.messageId,
        },
      },
      update: { archivedAt: new Date() },
      create: { userId: params.actor.userId, messageId: params.messageId },
    });
  } else {
    await prisma.userMessageArchive.deleteMany({
      where: { userId: params.actor.userId, messageId: params.messageId },
    });
  }
}

export async function setConversationMuted(params: {
  organizationId: string;
  actor: Actor;
  conversationId: string;
  muted: boolean;
}) {
  assertCanUse(params.actor);
  await getParticipantOrThrow(
    params.conversationId,
    params.actor.userId,
    params.organizationId,
  );
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.actor.userId,
      },
    },
    data: { mutedAt: params.muted ? new Date() : null },
  });
}

export async function countUnreadConversations(params: {
  organizationId: string;
  actor: Actor;
}) {
  if (
    !canUseMessaging(actorPolicy(params.actor))
  ) {
    return 0;
  }
  const listed = await listMyConversations({
    organizationId: params.organizationId,
    actor: params.actor,
    filter: "unread",
  });
  // Badge global = total messages non lus (pas seulement le nb de conversations).
  return listed.unreadMessages;
}

/**
 * Compte les messages non lus par conversation (hors messages de l'utilisateur).
 */
async function countUnreadMessagesByConversation(params: {
  userId: string;
  conversationIds: string[];
}): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (params.conversationIds.length === 0) return result;

  const rows = await prisma.$queryRaw<
    Array<{ conversationId: string; count: bigint | number }>
  >(Prisma.sql`
    SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS count
    FROM "Message" m
    INNER JOIN "ConversationParticipant" p
      ON p."conversationId" = m."conversationId"
     AND p."userId" = ${params.userId}
     AND p."leftAt" IS NULL
    WHERE m."conversationId" IN (${Prisma.join(params.conversationIds)})
      AND m."deletedAt" IS NULL
      AND m."senderId" <> ${params.userId}
      AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")
    GROUP BY m."conversationId"
  `);

  for (const row of rows) {
    result.set(row.conversationId, Number(row.count));
  }
  return result;
}

export async function purgeOrganizationMessaging(params: {
  organizationId: string;
  actor: Actor;
  confirmation: string;
  conversationId?: string | null;
  before?: string | null;
}) {
  if (
    !canPurgeOrganizationMessaging({
      appRole: params.actor.appRole,
      memberRole: params.actor.memberRole,
    })
  ) {
    throw new MessagingError(messagingDeniedMessage("manage"));
  }
  if (params.confirmation.trim().toUpperCase() !== MESSAGING_PURGE_CONFIRMATION) {
    throw new MessagingError(
      `Saisissez ${MESSAGING_PURGE_CONFIRMATION} pour confirmer le nettoyage.`,
    );
  }

  const before = params.before ? new Date(params.before) : null;
  if (params.before && before && Number.isNaN(before.getTime())) {
    throw new MessagingError("Date de filtre invalide.");
  }

  const where: Prisma.ConversationWhereInput = {
    organizationId: params.organizationId,
    deletedAt: null,
    type: { not: "CONTEXTUAL" },
    ...(params.conversationId ? { id: params.conversationId } : {}),
    ...(before ? { updatedAt: { lte: before } } : {}),
  };

  const result = await prisma.$transaction(async (tx) => {
    const conversations = await tx.conversation.findMany({
      where,
      select: { id: true },
    });
    const ids = conversations.map((row) => row.id);
    if (ids.length === 0) {
      return { conversations: 0, messages: 0 };
    }
    const messages = await tx.message.updateMany({
      where: { conversationId: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await tx.conversation.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
    await tx.messagingAuditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actor.userId,
        action: "PURGE",
        details: JSON.stringify({
          conversationIds: ids,
          conversationCount: ids.length,
          messages: messages.count,
          before: before?.toISOString() ?? null,
        }),
      },
    });
    return { conversations: ids.length, messages: messages.count };
  });

  return result;
}
