import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  getGroupSettings,
  markConversationRead,
  markConversationUnread,
  MessagingError,
  setConversationArchived,
  setConversationMuted,
  setGroupParticipantRole,
  setGroupRepliesLocked,
} from "@/lib/messaging/messaging-service";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ organizationId: string; conversationId: string }>;
};

export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, conversationId } = await context.params;
    const body = (await request.json()) as {
      action?:
        | "read"
        | "unread"
        | "archive"
        | "unarchive"
        | "mute"
        | "unmute"
        | "lock_replies"
        | "unlock_replies"
        | "set_role";
      userId?: string;
      role?: "ADMIN" | "MEMBER";
    };

    const actor = await getMessagingActorFromSession(session, organizationId);

    switch (body.action) {
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
        if (!body.userId || (body.role !== "ADMIN" && body.role !== "MEMBER")) {
          return jsonError("userId et role (ADMIN|MEMBER) requis.", 400);
        }
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
    const status = error instanceof MessagingError ? 400 : 500;
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
    const status = error instanceof MessagingError ? 400 : 500;
    return jsonError(
      error instanceof Error ? error.message : "Chargement impossible.",
      status,
    );
  }
}
