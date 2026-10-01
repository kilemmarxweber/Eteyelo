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
import { toPlainClientMessageBody } from "@/lib/notify/notify-message-card";

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
    const data = await getConversationMessages({
      organizationId,
      actor,
      conversationId,
      cursor,
    });
    return jsonOk({
      ...data,
      items: data.items.map((item) => ({
        ...item,
        body: toPlainClientMessageBody(item.body),
        replyTo: item.replyTo
          ? {
              ...item.replyTo,
              body: toPlainClientMessageBody(item.replyTo.body),
            }
          : null,
      })),
    });
  } catch (error) {
    const status = error instanceof MessagingError ? 400 : 500;
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
    const body = (await request.json()) as {
      body?: string;
      replyToId?: string;
      clientMessageId?: string;
    };

    if (!body.body?.trim()) {
      return jsonError("Message vide.", 400);
    }

    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await sendMessage({
      organizationId,
      actor,
      conversationId,
      body: body.body,
      replyToId: body.replyToId,
      clientMessageId: body.clientMessageId,
    });
    return jsonCreated(data);
  } catch (error) {
    const status = error instanceof MessagingError ? 400 : 500;
    return jsonError(
      error instanceof Error ? error.message : "Envoi échoué.",
      status,
    );
  }
}
