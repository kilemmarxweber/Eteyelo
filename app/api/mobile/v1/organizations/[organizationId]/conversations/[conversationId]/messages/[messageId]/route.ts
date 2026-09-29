import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  deleteMessage,
  editMessage,
  MessagingError,
} from "@/lib/messaging/messaging-service";
import { MESSAGING_MAX_BODY_LENGTH } from "@/lib/messaging/messaging-types";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{
    organizationId: string;
    conversationId: string;
    messageId: string;
  }>;
};

export async function PATCH(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, conversationId, messageId } = await context.params;
    let payload: { body?: string };
    try {
      payload = (await request.json()) as { body?: string };
    } catch {
      return jsonError("Corps JSON invalide.", 400);
    }

    const text = typeof payload.body === "string" ? payload.body : "";
    if (!text.trim()) {
      return jsonError("Message vide.", 400);
    }
    if (text.length > MESSAGING_MAX_BODY_LENGTH + 50) {
      return jsonError("Message trop long.", 400);
    }

    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await editMessage({
      organizationId,
      actor,
      messageId,
      conversationId,
      body: text,
    });

    return jsonOk(data);
  } catch (error) {
    const status = error instanceof MessagingError ? 400 : 500;
    return jsonError(
      error instanceof Error ? error.message : "Modification échouée.",
      status,
    );
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, conversationId, messageId } = await context.params;
    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await deleteMessage({
      organizationId,
      actor,
      messageId,
      conversationId,
    });

    return jsonOk(data);
  } catch (error) {
    const status = error instanceof MessagingError ? 400 : 500;
    return jsonError(
      error instanceof Error ? error.message : "Suppression échouée.",
      status,
    );
  }
}
