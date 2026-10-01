import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  MessagingError,
  searchMessagingRecipients,
} from "@/lib/messaging/messaging-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const cursor = url.searchParams.get("cursor");

    const actor = await getMessagingActorFromSession(session, organizationId);
    const data = await searchMessagingRecipients({
      organizationId,
      actor,
      query,
      cursor,
    });
    return jsonOk(data);
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Recherche échouée.",
      status,
    );
  }
}
