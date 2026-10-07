import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  getGroupSettings,
  markMessagesDelivered,
  markConversationRead,
  markConversationUnread,
  MessagingError,
  removeConversationForMe,
  setConversationArchived,
  setConversationMuted,
  setGroupParticipantRole,
  setGroupRepliesLocked,
} from "@/lib/messaging/messaging-service";
import {
  mobileConversationActionSchema,
  zodErrorMessage,
} from "@/lib/mobile/messaging-schemas";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ organizationId: string; conversationId: string }>;
};

export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, conversationId } = await context.params;
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError("Corps JSON invalide.", 400);
    }

    const parsed = mobileConversationActionSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(zodErrorMessage(parsed.error), 400);
    }

    const actor = await getMessagingActorFromSession(session, organizationId);
    const body = parsed.data;

    switch (body.action) {
      case "delivered": {
        const data = await markMessagesDelivered({
          organizationId,
          actor,
          conversationId,
          messageIds: body.messageIds,
        });
        return jsonOk({ conversationId, action: body.action, ...data });
      }
      case "read":
        await markConversationRead({
          organizationId,
          actor,
          conversationId,
        });
        break;
      case "unread":
        await markConversationUnread({
          organizationId,
          actor,
          conversationId,
        });
        break;
      case "archive":
        await setConversationArchived({
          organizationId,
          actor,
          conversationId,
          archived: true,
        });
        break;
      case "unarchive":
        await setConversationArchived({
          organizationId,
          actor,
          conversationId,
          archived: false,
        });
        break;
      case "delete":
        await removeConversationForMe({
          organizationId,
          actor,
          conversationId,
        });
        break;
      case "mute":
        await setConversationMuted({
          organizationId,
          actor,
          conversationId,
          muted: true,
        });
        break;
      case "unmute":
        await setConversationMuted({
          organizationId,
          actor,
          conversationId,
          muted: false,
        });
        break;
      case "lock_replies":
        await setGroupRepliesLocked({
          organizationId,
          actor,
          conversationId,
          locked: true,
        });
        break;
      case "unlock_replies":
        await setGroupRepliesLocked({
          organizationId,
          actor,
          conversationId,
          locked: false,
        });
        break;
      case "set_role": {
        const data = await setGroupParticipantRole({
          organizationId,
          actor,
          conversationId,
          targetUserId: body.userId,
          role: body.role,
        });
        return jsonOk(data);
      }
      default:
        return jsonError("Action invalide.", 400);
    }

    return jsonOk({ conversationId, action: body.action });
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Action échouée.",
      status,
    );
  }
}

/** Paramètres / membres du groupe. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, conversationId } = await context.params;
    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await getGroupSettings({
      organizationId,
      actor,
      conversationId,
    });
    return jsonOk(data);
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Chargement impossible.",
      status,
    );
  }
}
