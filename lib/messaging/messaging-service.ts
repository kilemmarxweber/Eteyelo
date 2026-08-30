import { orgRoleLabel } from "@/lib/org-role-labels";
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
  MESSAGING_MAX_RECIPIENTS,
  MESSAGING_MAX_SUBJECT_LENGTH,
  MESSAGING_MESSAGES_PAGE_SIZE,
  MESSAGING_PURGE_CONFIRMATION,
  MESSAGING_RATE_LIMIT_PER_MINUTE,
  MESSAGING_SEARCH_PAGE_SIZE,
  previewMessageBody,
  sanitizeMessageBody,
  type ConversationContextTypeValue,
  type ConversationListItem,
  type ConversationTypeValue,
  type MessageView,
  type MessagingFilter,
  type MessagingRecipient,
} from "@/lib/messaging/messaging-types";
import type { Prisma } from "@/prisma/generated/prisma/client";

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

type Actor = {
  userId: string;
  appRole: string;
  memberRole: string | null;
  memberArchived: boolean;
  userBanned: boolean;
  sourceBranchId?: string | null;
  messagingEnabled?: boolean;
};

export class MessagingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingError";
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
    );
  }
}

function assertCanSend(actor: Actor) {
  if (!canSendMessages(actorPolicy(actor))) {
    throw new MessagingError(
      actor.messagingEnabled === false
        ? messagingDeniedMessage("disabled")
        : messagingDeniedMessage("send"),
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
      user: { select: userNameSelect },
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
    take: 200,
  });

  const needle = q.toLowerCase();
  const filtered = members.filter((member) => {
    const extraRoles = member.branchMember.map((row) => String(row.role));
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
    const role = orgRoleLabel(
      member.role.split(",")[0] ?? member.role,
    ).toLowerCase();
    const branches = member.branchMember
      .map((row) => row.branch.name.toLowerCase())
      .join(" ");
    return (
      name.includes(needle) ||
      email.includes(needle) ||
      role.includes(needle) ||
      branches.includes(needle)
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
  const body = sanitizeMessageBody(params.body);
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
            lastReadAt: userId === params.actor.userId ? new Date() : null,
          })),
        },
      },
      select: { id: true },
    });

    await insertMessageAndNotify(tx, {
      organizationId: params.organizationId,
      conversationId: conversation.id,
      senderId: params.actor.userId,
      body,
      clientMessageId: params.clientMessageId,
      sourceBranchId: params.actor.sourceBranchId ?? null,
    });

    return conversation.id;
  });

  return { conversationId: created, reused: false };
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

  const body = params.body ? sanitizeMessageBody(params.body) : "";
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
  },
) {
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
  const body = sanitizeMessageBody(params.body);
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
    }),
  );

  return { messageId: message.id, conversationId: params.conversationId, reused: false };
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
        where: { deletedAt: null },
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

  const items: ConversationListItem[] = [];
  for (const row of rows) {
    const me = row.participants.find((p) => p.userId === params.actor.userId);
    if (!me) continue;
    const last = row.messages[0];
    const unreadCount =
      last &&
      last.senderId !== params.actor.userId &&
      (!me.lastReadAt || last.createdAt > me.lastReadAt)
        ? 1
        : 0;

    const participants = row.participants.map((p) => {
      const mapped = recipientMap.get(p.userId);
      return {
        userId: p.userId,
        name: mapped?.name ?? formatMessagingPersonName(p.user),
        image: mapped?.image ?? p.user.image,
        roleLabel: mapped?.roleLabel ?? "",
        branches: mapped?.branches ?? [],
      };
    });

    const item: ConversationListItem = {
      id: row.id,
      type: row.type,
      subject: row.subject,
      contextType: row.contextType,
      contextId: row.contextId,
      contextHref: contextHref({
        organizationId: params.organizationId,
        contextType: row.contextType,
        contextId: row.contextId,
        sourceBranchId: row.sourceBranchId,
      }),
      updatedAt: row.updatedAt.toISOString(),
      lastMessage: last
        ? {
            id: last.id,
            body: last.body,
            senderId: last.senderId,
            senderName: formatMessagingPersonName(last.sender),
            createdAt: last.createdAt.toISOString(),
          }
        : null,
      unreadCount,
      archived: Boolean(me.archivedAt),
      muted: Boolean(me.mutedAt),
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
  return {
    items: page,
    nextCursor:
      start + page.length < items.length ? page[page.length - 1]?.id ?? null : null,
    unreadConversations: items.filter((row) => !row.archived && row.unreadCount > 0)
      .length,
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
      deletedAt: null,
      ...(params.cursor ? { createdAt: { lt: new Date(params.cursor) } } : {}),
    },
    include: {
      sender: { select: userNameSelect },
      replyTo: {
        select: {
          id: true,
          body: true,
          sender: { select: userNameSelect },
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
      return {
        id: row.id,
        conversationId: row.conversationId,
        senderId: row.senderId,
        senderName: mapped?.name ?? formatMessagingPersonName(row.sender),
        senderImage: mapped?.image ?? row.sender.image,
        senderRoleLabel: mapped?.roleLabel ?? "",
        senderBranches: mapped?.branches ?? [],
        body: row.body,
        replyTo: row.replyTo
          ? {
              id: row.replyTo.id,
              senderName: formatMessagingPersonName(row.replyTo.sender),
              body: row.replyTo.body,
            }
          : null,
        createdAt: row.createdAt.toISOString(),
        archivedForMe: row.archives.length > 0,
      };
    });

  return {
    items,
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
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.actor.userId,
      },
    },
    data: { lastReadAt: new Date() },
  });
  await prisma.appNotification.updateMany({
    where: {
      conversationId: params.conversationId,
      userId: params.actor.userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
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
  return listed.unreadConversations;
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
