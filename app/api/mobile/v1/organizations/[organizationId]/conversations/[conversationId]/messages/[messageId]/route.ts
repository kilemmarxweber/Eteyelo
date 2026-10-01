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
import {
  mobileEditMessageSchema,
  zodErrorMessage,
} from "@/lib/mobile/messaging-schemas";

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
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError("Corps JSON invalide.", 400);
    }

    const parsed = mobileEditMessageSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(zodErrorMessage(parsed.error), 400);
    }

    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await editMessage({
      organizationId,
      actor,
      messageId,
      conversationId,
      body: parsed.data.body,
    });

    return jsonOk(data);
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
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
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Suppression échouée.",
      status,
    );
  }
}
