import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { publishMobileEvent } from "@/lib/mobile/realtime";
import { saveCallAnswer } from "@/lib/mobile/call-signal-store";
import {
  appendCallTraceMessage,
  MessagingError,
} from "@/lib/messaging/messaging-service";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ organizationId: string; callId: string }>;
};

async function writeCallTrace(params: {
  organizationId: string;
  callId: string;
  actorUserId: string;
  status: string;
  endReason?: string | null;
}) {
  const call = await prisma.callSession.findFirst({
    where: { id: params.callId, organizationId: params.organizationId },
    select: {
      id: true,
      kind: true,
      conversationId: true,
      answeredAt: true,
      endedAt: true,
      startedAt: true,
    },
  });
  if (!call?.conversationId) return;

  const end = call.endedAt ?? new Date();
  const durationMs = call.answeredAt
    ? Math.max(0, end.getTime() - call.answeredAt.getTime())
    : 0;

  await appendCallTraceMessage({
    organizationId: params.organizationId,
    conversationId: call.conversationId,
    actorUserId: params.actorUserId,
    callId: call.id,
    kind: call.kind === "VIDEO" ? "VIDEO" : "AUDIO",
    status: params.status,
    endReason: params.endReason,
    durationMs,
  });
}

export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, callId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);

    const body = (await request.json()) as {
      action?: "answer" | "reject" | "hangup";
      endReason?: string;
      sdp?: { type?: string; sdp?: string };
      dtls?: unknown;
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
      if (call.calleeId !== session.user.id) {
        return jsonError("Seul le destinataire peut répondre.", 403);
      }
      if (call.status === "ACTIVE") {
        return jsonOk({ callId, status: "ACTIVE" });
      }
      if (call.status !== "RINGING") {
        return jsonError("Cet appel ne peut plus être accepté.", 409);
      }
      await prisma.callSession.update({
        where: { id: callId },
        data: { status: "ACTIVE", answeredAt: new Date() },
      });
      const answerPayload = {
        conversationId: call.conversationId,
        ...(body.sdp ? { sdp: body.sdp } : {}),
        ...(body.sdp && body.dtls ? { dtls: body.dtls } : {}),
      };
      // Persister + publier uniquement avec SDP (pas de dtls orphelin sans réponse).
      if (body.sdp) {
        await saveCallAnswer(callId, answerPayload);
        await publishMobileEvent({
          type: "call.answer",
          organizationId,
          callId,
          fromUserId: session.user.id,
          toUserId: peerId,
          payload: answerPayload,
        });
      }
      return jsonOk({ callId, status: "ACTIVE" });
    }

    if (body.action === "reject") {
      if (call.calleeId !== session.user.id) {
        return jsonError("Seul le destinataire peut refuser.", 403);
      }
      if (
        call.status === "REJECTED" ||
        call.status === "ENDED" ||
        call.status === "MISSED"
      ) {
        return jsonOk({ callId, status: call.status });
      }
      if (call.status !== "RINGING") {
        return jsonError("Cet appel ne peut plus être refusé.", 409);
      }
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
        payload: { conversationId: call.conversationId, status: "REJECTED" },
      });
      await writeCallTrace({
        organizationId,
        callId,
        actorUserId: session.user.id,
        status: "REJECTED",
        endReason: "rejected",
      });
      return jsonOk({ callId, status: "REJECTED" });
    }

    if (body.action === "hangup") {
      if (
        call.status === "ENDED" ||
        call.status === "MISSED" ||
        call.status === "REJECTED"
      ) {
        return jsonOk({ callId, status: call.status });
      }
      let status: "ENDED" | "MISSED" = "ENDED";
      let endReason = body.endReason ?? "hangup";
      if (call.status === "RINGING") {
        if (session.user.id === call.callerId) {
          status = "ENDED";
          endReason = "cancelled";
        } else {
          status = "MISSED";
          endReason = "missed";
        }
      }
      await prisma.callSession.update({
        where: { id: callId },
        data: {
          status,
          endedAt: new Date(),
          endReason,
        },
      });
      await publishMobileEvent({
        type: "call.hangup",
        organizationId,
        callId,
        fromUserId: session.user.id,
        toUserId: peerId,
        payload: {
          status,
          endReason,
          conversationId: call.conversationId,
        },
      });
      await writeCallTrace({
        organizationId,
        callId,
        actorUserId: session.user.id,
        status,
        endReason,
      });
      return jsonOk({ callId, status });
    }

    return jsonError("Action invalide.", 400);
  } catch (error) {
    if (error instanceof MessagingError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError("Action appel échouée.", 500);
  }
}
