import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { publishMobileEvent } from "@/lib/mobile/realtime";
import {
  appendCallIce,
  readCallSignal,
  saveCallAnswer,
  saveCallOffer,
} from "@/lib/mobile/call-signal-store";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ organizationId: string; callId: string }>;
};

async function loadParty(organizationId: string, callId: string, userId: string) {
  const call = await prisma.callSession.findFirst({
    where: { id: callId, organizationId },
  });
  if (!call) return { error: jsonError("Appel introuvable.", 404), call: null };
  const isParty = call.callerId === userId || call.calleeId === userId;
  if (!isParty) return { error: jsonError("Accès refusé.", 403), call: null };
  return { error: null, call };
}

/** État signaling (offre, réponse, ICE) pour le pair qui n'a pas le websocket. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);
    const { organizationId, callId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);
    const { error, call } = await loadParty(organizationId, callId, session.user.id);
    if (error || !call) return error!;

    const signal = await readCallSignal(callId);
    const peerId = call.callerId === session.user.id ? call.calleeId : call.callerId;
    return jsonOk({
      status: call.status,
      callerId: call.callerId,
      calleeId: call.calleeId,
      kind: call.kind,
      offer: signal.offer ?? null,
      answer: signal.answer ?? null,
      ice: signal.ice
        .filter((item) => item.fromUserId === peerId)
        .map((item) => item.payload),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Signal indisponible.",
      500,
    );
  }
}

/** Relaye réponse ou ICE même si le websocket du pair est coupé. */
export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);
    const { organizationId, callId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);
    const { error, call } = await loadParty(organizationId, callId, session.user.id);
    if (error || !call) return error!;

    const body = (await request.json()) as {
      type?: "offer" | "answer" | "ice";
      payload?: unknown;
    };
    if (!body.type || body.payload == null) {
      return jsonError("type et payload requis.", 400);
    }

    const peerId = call.callerId === session.user.id ? call.calleeId : call.callerId;

    if (body.type === "offer") {
      await saveCallOffer(callId, body.payload);
    } else if (body.type === "answer") {
      await saveCallAnswer(callId, body.payload);
      await publishMobileEvent({
        type: "call.answer",
        organizationId,
        callId,
        fromUserId: session.user.id,
        toUserId: peerId,
        payload: body.payload,
      });
    } else if (body.type === "ice") {
      await appendCallIce(callId, session.user.id, body.payload);
      await publishMobileEvent({
        type: "call.ice",
        organizationId,
        callId,
        fromUserId: session.user.id,
        toUserId: peerId,
        payload: body.payload,
      });
    } else {
      return jsonError("Type de signal invalide.", 400);
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Signal non enregistré.",
      500,
    );
  }
}
