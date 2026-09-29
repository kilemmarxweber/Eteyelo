import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  countUnreadConversations,
  MessagingError,
} from "@/lib/messaging/messaging-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    const actor = await getMessagingActorFromSession(session, organizationId);
    const count = await countUnreadConversations({
      organizationId,
      actor,
    });
    return jsonOk({ count });
  } catch (error) {
    const status = error instanceof MessagingError ? 400 : 500;
    return jsonError(
      error instanceof Error ? error.message : "Erreur badge.",
      status,
    );
  }
}
