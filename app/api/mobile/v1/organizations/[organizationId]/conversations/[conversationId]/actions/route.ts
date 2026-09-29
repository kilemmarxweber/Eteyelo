import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  markConversationRead,
  MessagingError,
  setConversationArchived,
  setConversationMuted,
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
      action?: "read" | "archive" | "unarchive" | "mute" | "unmute";
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
