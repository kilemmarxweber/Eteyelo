import { prisma } from "@/lib/prisma";
import { MessagingError } from "@/lib/messaging/messaging-service";

const NOTIFY_PREFIX = "__NOTIFY__:";

export type NoticeAckResult = {
  messageId: string;
  acked: boolean;
  ackCount: number;
  createdAt: string;
};

async function loadAckableMessage(params: {
  organizationId: string;
  messageId: string;
  userId: string;
}) {
  const message = await prisma.message.findFirst({
    where: {
      id: params.messageId,
      deletedAt: null,
      conversation: {
        organizationId: params.organizationId,
        deletedAt: null,
        participants: {
          some: {
            userId: params.userId,
            leftAt: null,
          },
        },
      },
    },
    select: {
      id: true,
      body: true,
      conversationId: true,
    },
  });

  if (!message) {
    throw new MessagingError("Avis introuvable.", 404);
  }

  if (!message.body.trimStart().startsWith(NOTIFY_PREFIX)) {
    throw new MessagingError("Ce message n'est pas un avis officiel.", 400);
  }

  return message;
}

export async function acknowledgeNotice(params: {
  organizationId: string;
  messageId: string;
  userId: string;
}): Promise<NoticeAckResult> {
  await loadAckableMessage(params);

  const existing = await prisma.noticeAck.findUnique({
    where: {
      messageId_userId: {
        messageId: params.messageId,
        userId: params.userId,
      },
    },
    select: { id: true, createdAt: true },
  });

  let createdAt: Date;
  if (existing) {
    createdAt = existing.createdAt;
  } else {
    const created = await prisma.noticeAck.create({
      data: {
        messageId: params.messageId,
        userId: params.userId,
        organizationId: params.organizationId,
      },
      select: { createdAt: true },
    });
    createdAt = created.createdAt;
  }

  const ackCount = await prisma.noticeAck.count({
    where: { messageId: params.messageId },
  });

  return {
    messageId: params.messageId,
    acked: true,
    ackCount,
    createdAt: createdAt.toISOString(),
  };
}

export async function getNoticeAckStatus(params: {
  organizationId: string;
  messageId: string;
  userId: string;
}): Promise<NoticeAckResult> {
  await loadAckableMessage(params);

  const [mine, ackCount] = await Promise.all([
    prisma.noticeAck.findUnique({
      where: {
        messageId_userId: {
          messageId: params.messageId,
          userId: params.userId,
        },
      },
      select: { createdAt: true },
    }),
    prisma.noticeAck.count({
      where: { messageId: params.messageId },
    }),
  ]);

  return {
    messageId: params.messageId,
    acked: Boolean(mine),
    ackCount,
    createdAt: mine?.createdAt.toISOString() ?? new Date(0).toISOString(),
  };
}
