import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonCreated,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  getConversationMessages,
  MessagingError,
  sendMessage,
} from "@/lib/messaging/messaging-service";
import {
  mobileSendMessageSchema,
  zodErrorMessage,
} from "@/lib/mobile/messaging-schemas";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ organizationId: string; conversationId: string }>;
};

export async function GET(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, conversationId } = await context.params;
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");

    const actor = await getMessagingActorFromSession(session, organizationId);
    // Garder `__NOTIFY__:{json}` intact : Klambo mobile rend les cartes scolaires.
    const data = await getConversationMessages({
      organizationId,
      actor,
      conversationId,
      cursor,
    });
    return jsonOk(data);
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Erreur messages.",
      status,
    );
  }
}

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

    const parsed = mobileSendMessageSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(zodErrorMessage(parsed.error), 400);
    }

    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await sendMessage({
      organizationId,
      actor,
      conversationId,
      body: parsed.data.body,
      replyToId: parsed.data.replyToId,
      clientMessageId: parsed.data.clientMessageId,
    });
    return jsonCreated(data);
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Envoi échoué.",
      status,
    );
  }
}
