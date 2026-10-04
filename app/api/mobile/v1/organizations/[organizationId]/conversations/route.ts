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
import {
  mobileCreateConversationSchema,
  zodErrorMessage,
} from "@/lib/mobile/messaging-schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

const FILTERS = new Set<MessagingFilter>([
  "all",
  "unread",
  "groups",
  "direct",
  "archived",
]);

export async function GET(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    const url = new URL(request.url);
    const filterRaw = url.searchParams.get("filter") ?? "all";
    const filter = (FILTERS.has(filterRaw as MessagingFilter)
      ? filterRaw
      : "all") as MessagingFilter;
    const cursor = url.searchParams.get("cursor");
    const since = url.searchParams.get("since");
    const query = (url.searchParams.get("query") ?? "").slice(0, 80);

    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await listMyConversations({
      organizationId,
      actor,
      filter,
      cursor,
      since,
      query: query || undefined,
    });
    return jsonOk(data);
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
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
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError("Corps JSON invalide.", 400);
    }

    const parsed = mobileCreateConversationSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(zodErrorMessage(parsed.error), 400);
    }

    const actor = await getMessagingActorFromSession(session, organizationId);
    const { recipientIds, body, subject, clientMessageId, asGroup } =
      parsed.data;

    // Pas de contextType / contextId depuis mobile — réservé au web admin.
    if (asGroup || recipientIds.length > 1) {
      const groupSubject = (subject ?? "").trim();
      if (!groupSubject) {
        return jsonError("Le nom du groupe est obligatoire.", 400);
      }
      const data = await createGroup({
        organizationId,
        actor,
        recipientIds,
        subject: groupSubject,
        body: body ?? "",
        clientMessageId,
      });
      return jsonCreated(data);
    }

    if (!(body ?? "").trim()) {
      return jsonError("Message vide.", 400);
    }

    const data = await createConversation({
      organizationId,
      actor,
      recipientIds,
      body: body ?? "",
      clientMessageId,
    });
    return jsonCreated(data);
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Création conversation échouée.",
      status,
    );
  }
}
