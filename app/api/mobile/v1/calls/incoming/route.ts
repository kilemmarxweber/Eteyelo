import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { readCallSignal } from "@/lib/mobile/call-signal-store";

export const runtime = "nodejs";

/** Appels qui sonnent pour l'utilisateur connecté (secours si le WS rate). */
export async function GET() {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const since = new Date(Date.now() - 90_000);
    const calls = await prisma.callSession.findMany({
      where: {
        calleeId: session.user.id,
        status: "RINGING",
        startedAt: { gte: since },
      },
      orderBy: { startedAt: "desc" },
      take: 3,
      include: {
        caller: { select: { name: true, prenom: true } },
      },
    });

    const items = await Promise.all(
      calls.map(async (call) => {
        const signal = await readCallSignal(call.id);
        const offer = signal.offer;
        let sdp: unknown = null;
        let dtls: unknown = null;
        if (typeof offer === "string") {
          sdp = offer;
        } else if (offer && typeof offer === "object" && "sdp" in offer) {
          sdp = (offer as { sdp?: unknown }).sdp ?? null;
          dtls = (offer as { dtls?: unknown }).dtls ?? null;
        }
        const callerName =
          [call.caller?.prenom, call.caller?.name].filter(Boolean).join(" ") ||
          "Appel entrant";
        return {
          callId: call.id,
          organizationId: call.organizationId,
          callerId: call.callerId,
          callerName,
          kind: call.kind,
          conversationId: call.conversationId,
          startedAt: call.startedAt.toISOString(),
          sdp,
          dtls,
        };
      }),
    );

    return jsonOk({ items });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Appels entrants indisponibles.",
      500,
    );
  }
}
