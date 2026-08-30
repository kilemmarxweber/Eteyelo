"use server";

import { z } from "zod";
import { action } from "@/lib/zsa";
import { getCachedSession } from "@/lib/auth/get-session-cached";
import { guardOrganizationAccess } from "@/lib/auth/require-organization-permission";
import { prisma } from "@/lib/prisma";
import { APP_ROLE } from "@/lib/permissions";
import { MessagingError } from "@/lib/messaging/messaging-service";
import {
  countUnreadConversations,
  createConversation,
  createGroup,
  getConversationMessages,
  isOrganizationMessagingEnabled,
  listMyConversations,
  markConversationRead,
  purgeOrganizationMessaging,
  searchMessagingRecipients,
  sendMessage,
  setConversationArchived,
  setConversationMuted,
  setMessageArchived,
} from "@/lib/messaging/messaging-service";
import {
  MESSAGING_MAX_BODY_LENGTH,
  MESSAGING_MAX_RECIPIENTS,
  MESSAGING_MAX_SUBJECT_LENGTH,
  type MessagingFilter,
} from "@/lib/messaging/messaging-types";

async function getMessagingActor(organizationId: string) {
  const guard = await guardOrganizationAccess(organizationId);
  if (!guard.ok) {
    throw new MessagingError(guard.message);
  }
  const session = await getCachedSession();
  const userId = guard.context.userId;
  const member = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      role: true,
      isArchived: true,
      user: { select: { banned: true } },
    },
  });
  const sourceBranchId =
    session?.session?.activeBranchId ?? session?.branch?.id ?? null;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { messagingEnabled: true },
  });

  return {
    userId,
    appRole: guard.context.appRole ?? APP_ROLE.USER,
    memberRole: member?.role ?? null,
    memberArchived: member?.isArchived ?? false,
    userBanned: member?.user.banned ?? false,
    sourceBranchId,
    messagingEnabled: org?.messagingEnabled !== false,
  };
}

function wrap<T>(fn: () => Promise<T>) {
  return fn().catch((error) => {
    if (error instanceof MessagingError) throw error;
    throw error;
  });
}

const organizationIdSchema = z.string().min(1);
const conversationIdSchema = z.string().min(1);

export const searchMessagingRecipientsAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      query: z.string().max(80).default(""),
      cursor: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    return wrap(() =>
      searchMessagingRecipients({
        organizationId: input.organizationId,
        actor,
        query: input.query,
        cursor: input.cursor,
      }),
    );
  });

export const createConversationAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      recipientIds: z.array(z.string().min(1)).max(MESSAGING_MAX_RECIPIENTS).default([]),
      body: z.string().min(1).max(MESSAGING_MAX_BODY_LENGTH + 50),
      subject: z.string().max(MESSAGING_MAX_SUBJECT_LENGTH).optional().nullable(),
      clientMessageId: z.string().max(80).optional().nullable(),
      contextType: z
        .enum([
          "ABSENCE_CASE",
          "GRADE_MODIFICATION",
          "REGISTRATION_REQUEST",
          "SUPPORT_TICKET",
        ])
        .optional()
        .nullable(),
      contextId: z.string().min(1).optional().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    return wrap(() =>
      createConversation({
        organizationId: input.organizationId,
        actor,
        recipientIds: input.recipientIds,
        body: input.body,
        subject: input.subject,
        clientMessageId: input.clientMessageId,
        contextType: input.contextType,
        contextId: input.contextId,
      }),
    );
  });

export const createGroupAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      recipientIds: z
        .array(z.string().min(1))
        .min(1)
        .max(MESSAGING_MAX_RECIPIENTS),
      subject: z.string().min(1).max(MESSAGING_MAX_SUBJECT_LENGTH),
      body: z
        .string()
        .max(MESSAGING_MAX_BODY_LENGTH + 50)
        .optional()
        .nullable(),
      clientMessageId: z.string().max(80).optional().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    return wrap(() =>
      createGroup({
        organizationId: input.organizationId,
        actor,
        recipientIds: input.recipientIds,
        subject: input.subject,
        body: input.body,
        clientMessageId: input.clientMessageId,
      }),
    );
  });

export const listMyConversationsAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      filter: z
        .enum(["all", "unread", "groups", "direct", "archived"])
        .default("all"),
      query: z.string().max(80).optional(),
      cursor: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    return wrap(() =>
      listMyConversations({
        organizationId: input.organizationId,
        actor,
        filter: input.filter as MessagingFilter,
        query: input.query,
        cursor: input.cursor,
      }),
    );
  });

export const getConversationMessagesAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      conversationId: conversationIdSchema,
      cursor: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    return wrap(() =>
      getConversationMessages({
        organizationId: input.organizationId,
        actor,
        conversationId: input.conversationId,
        cursor: input.cursor,
      }),
    );
  });

export const sendMessageAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      conversationId: conversationIdSchema,
      body: z.string().min(1).max(MESSAGING_MAX_BODY_LENGTH + 50),
      replyToId: z.string().min(1).optional().nullable(),
      clientMessageId: z.string().max(80).optional().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    return wrap(() =>
      sendMessage({
        organizationId: input.organizationId,
        actor,
        conversationId: input.conversationId,
        body: input.body,
        replyToId: input.replyToId,
        clientMessageId: input.clientMessageId,
      }),
    );
  });

export const markConversationReadAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      conversationId: conversationIdSchema,
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    await wrap(() =>
      markConversationRead({
        organizationId: input.organizationId,
        actor,
        conversationId: input.conversationId,
      }),
    );
    return { ok: true };
  });

export const archiveConversationAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      conversationId: conversationIdSchema,
      archived: z.boolean(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    await wrap(() =>
      setConversationArchived({
        organizationId: input.organizationId,
        actor,
        conversationId: input.conversationId,
        archived: input.archived,
      }),
    );
    return { ok: true };
  });

export const archiveMessageAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      messageId: z.string().min(1),
      archived: z.boolean(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    await wrap(() =>
      setMessageArchived({
        organizationId: input.organizationId,
        actor,
        messageId: input.messageId,
        archived: input.archived,
      }),
    );
    return { ok: true };
  });

export const toggleConversationMuteAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      conversationId: conversationIdSchema,
      muted: z.boolean(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    await wrap(() =>
      setConversationMuted({
        organizationId: input.organizationId,
        actor,
        conversationId: input.conversationId,
        muted: input.muted,
      }),
    );
    return { ok: true };
  });

export const getMessagingUnreadCountAction = action
  .input(z.object({ organizationId: organizationIdSchema }))
  .handler(async ({ input }) => {
    const enabled = await isOrganizationMessagingEnabled(input.organizationId);
    if (!enabled) return { count: 0 };
    const actor = await getMessagingActor(input.organizationId);
    const count = await countUnreadConversations({
      organizationId: input.organizationId,
      actor,
    });
    return { count };
  });

export const purgeOrganizationMessagingAction = action
  .input(
    z.object({
      organizationId: organizationIdSchema,
      confirmation: z.string().min(1),
      conversationId: z.string().min(1).optional().nullable(),
      before: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const actor = await getMessagingActor(input.organizationId);
    return wrap(() =>
      purgeOrganizationMessaging({
        organizationId: input.organizationId,
        actor,
        confirmation: input.confirmation,
        conversationId: input.conversationId,
        before: input.before,
      }),
    );
  });
