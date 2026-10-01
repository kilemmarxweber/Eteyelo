import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonCreated,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { publishMobileEvent } from "@/lib/mobile/realtime";
import { MessagingError } from "@/lib/messaging/messaging-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

/** Démarre un appel 1:1 (signaling ensuite via WS). */
export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);

    const body = (await request.json()) as {
      calleeId?: string;
      kind?: "AUDIO" | "VIDEO";
      conversationId?: string;
      /** SDP WebRTC offer (créé côté appelant avant/après POST). */
      sdp?: { type: string; sdp: string };
      callerName?: string;
    };

    if (!body.calleeId) return jsonError("calleeId requis.", 400);
    if (body.calleeId === session.user.id) {
      return jsonError("Impossible de s'appeler soi-même.", 400);
    }

    if (body.conversationId) {
      const shared = await prisma.conversationParticipant.findMany({
        where: {
          conversationId: body.conversationId,
          leftAt: null,
          conversation: { organizationId, deletedAt: null },
          userId: { in: [session.user.id, body.calleeId] },
        },
        select: { userId: true },
      });
      const ids = new Set(shared.map((p) => p.userId));
      if (!ids.has(session.user.id) || !ids.has(body.calleeId)) {
        return jsonError(
          "Conversation invalide pour cet appel (participants requis).",
          400,
        );
      }
    }

    const calleeMember = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: body.calleeId,
        },
      },
      select: { id: true, isArchived: true },
    });
    if (!calleeMember || calleeMember.isArchived) {
      return jsonError("Destinataire introuvable dans l'organisation.", 404);
    }

    const caller = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, prenom: true, image: true },
    });

    const call = await prisma.callSession.create({
      data: {
        organizationId,
        conversationId: body.conversationId ?? null,
        callerId: session.user.id,
        calleeId: body.calleeId,
        kind: body.kind === "VIDEO" ? "VIDEO" : "AUDIO",
        status: "RINGING",
      },
    });

    await publishMobileEvent({
      type: "call.offer",
      organizationId,
      callId: call.id,
      fromUserId: session.user.id,
      toUserId: body.calleeId,
      payload: {
        kind: call.kind,
        conversationId: call.conversationId,
        sdp: body.sdp ?? null,
        callerName:
          body.callerName ||
          [caller?.prenom, caller?.name].filter(Boolean).join(" ") ||
          "Appel entrant",
        callerImage: caller?.image ?? null,
      },
    });

    return jsonCreated({
      callId: call.id,
      status: call.status,
      kind: call.kind,
      calleeId: body.calleeId,
    });
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Appel impossible.",
      status,
    );
  }
}

/** Liste des appels récents. */
export async function GET(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);

    const calls = await prisma.callSession.findMany({
      where: {
        organizationId,
        OR: [
          { callerId: session.user.id },
          { calleeId: session.user.id },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: 40,
      select: {
        id: true,
        kind: true,
        status: true,
        callerId: true,
        calleeId: true,
        conversationId: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        endReason: true,
      },
    });

    return jsonOk({ items: calls });
  } catch (error) {
    return jsonError(
      error instanceof MessagingError
        ? error.message
        : "Erreur historique appels.",
      error instanceof MessagingError ? error.statusCode : 500,
    );
  }
}
