import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonCreated,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  createConversation,
  createGroup,
  listMyConversations,
  MessagingError,
} from "@/lib/messaging/messaging-service";
import type { MessagingFilter } from "@/lib/messaging/messaging-types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    const url = new URL(request.url);
    const filter = (url.searchParams.get("filter") ?? "all") as MessagingFilter;
    const cursor = url.searchParams.get("cursor");

    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await listMyConversations({
      organizationId,
      actor,
      filter,
      cursor,
    });
    return jsonOk(data);
  } catch (error) {
    const status = error instanceof MessagingError ? 400 : 500;
    return jsonError(
      error instanceof Error ? error.message : "Erreur conversations.",
      status,
    );
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    const body = (await request.json()) as {
      recipientIds?: string[];
      body?: string;
      subject?: string;
      clientMessageId?: string;
      asGroup?: boolean;
    };

    const actor = await getMessagingActorFromSession(session, organizationId);
    const recipientIds = body.recipientIds ?? [];

    if (body.asGroup || recipientIds.length > 1) {
      const subject = (body.subject ?? "").trim();
      if (!subject) {
        return jsonError("Le nom du groupe est obligatoire.", 400);
      }
      const data = await createGroup({
        organizationId,
        actor,
        recipientIds,
        subject,
        body: body.body ?? "",
        clientMessageId: body.clientMessageId,
      });
      return jsonCreated(data);
    }

    const data = await createConversation({
      organizationId,
      actor,
      recipientIds,
      body: body.body ?? "",
      clientMessageId: body.clientMessageId,
    });
    return jsonCreated(data);
  } catch (error) {
    const status = error instanceof MessagingError ? 400 : 500;
    return jsonError(
      error instanceof Error ? error.message : "Création conversation échouée.",
      status,
    );
  }
}
