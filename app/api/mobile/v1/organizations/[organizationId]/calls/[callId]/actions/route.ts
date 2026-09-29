import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { publishMobileEvent } from "@/lib/mobile/realtime";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ organizationId: string; callId: string }>;
};

export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, callId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);

    const body = (await request.json()) as {
      action?: "answer" | "reject" | "hangup";
      endReason?: string;
    };

    const call = await prisma.callSession.findFirst({
      where: { id: callId, organizationId },
    });
    if (!call) return jsonError("Appel introuvable.", 404);

    const isParty =
      call.callerId === session.user.id || call.calleeId === session.user.id;
    if (!isParty) return jsonError("Accès refusé.", 403);

    const peerId =
      call.callerId === session.user.id ? call.calleeId : call.callerId;

    if (body.action === "answer") {
      await prisma.callSession.update({
        where: { id: callId },
        data: { status: "ACTIVE", answeredAt: new Date() },
      });
      await publishMobileEvent({
        type: "call.answer",
        organizationId,
        callId,
        fromUserId: session.user.id,
        toUserId: peerId,
      });
      return jsonOk({ callId, status: "ACTIVE" });
    }

    if (body.action === "reject") {
      await prisma.callSession.update({
        where: { id: callId },
        data: {
          status: "REJECTED",
          endedAt: new Date(),
          endReason: body.endReason ?? "rejected",
        },
      });
      await publishMobileEvent({
        type: "call.reject",
        organizationId,
        callId,
        fromUserId: session.user.id,
        toUserId: peerId,
      });
      return jsonOk({ callId, status: "REJECTED" });
    }

    if (body.action === "hangup") {
      const status =
        call.status === "RINGING" && call.calleeId === session.user.id
          ? "MISSED"
          : "ENDED";
      await prisma.callSession.update({
        where: { id: callId },
        data: {
          status,
          endedAt: new Date(),
          endReason: body.endReason ?? "hangup",
        },
      });
      await publishMobileEvent({
        type: "call.hangup",
        organizationId,
        callId,
        fromUserId: session.user.id,
        toUserId: peerId,
        payload: { status },
      });
      return jsonOk({ callId, status });
    }

    return jsonError("Action invalide.", 400);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Action appel échouée.",
      500,
    );
  }
}
