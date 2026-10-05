import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  mobileErrorStatus,
  requireSession,
} from "@/lib/mobile/http";
import {
  acknowledgeNotice,
  getNoticeAckStatus,
} from "@/lib/notify/notice-ack";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ organizationId: string; messageId: string }>;
};

export async function GET(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, messageId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);

    const data = await getNoticeAckStatus({
      organizationId,
      messageId,
      userId: session.user.id,
    });

    return jsonOk(data);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Statut indisponible.",
      mobileErrorStatus(error),
    );
  }
}

export async function POST(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, messageId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);

    const data = await acknowledgeNotice({
      organizationId,
      messageId,
      userId: session.user.id,
    });

    return jsonOk(data);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Accusé impossible.",
      mobileErrorStatus(error),
    );
  }
}
