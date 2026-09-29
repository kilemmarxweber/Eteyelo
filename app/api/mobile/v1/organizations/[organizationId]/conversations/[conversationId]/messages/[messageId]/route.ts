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
    const body = (await request.json()) as { body?: string };

    if (!body.body?.trim()) {
      return jsonError("Message vide.", 400);
    }

    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await editMessage({
      organizationId,
      actor,
      messageId,
      body: body.body,
    });

    if (data.conversationId !== conversationId) {
      return jsonError("Message hors conversation.", 400);
    }

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
    });

    if (data.conversationId !== conversationId) {
      return jsonError("Message hors conversation.", 400);
    }

    return jsonOk(data);
  } catch (error) {
    const status = error instanceof MessagingError ? 400 : 500;
    return jsonError(
      error instanceof Error ? error.message : "Suppression échouée.",
      status,
    );
  }
}
