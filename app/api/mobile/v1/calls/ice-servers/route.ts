import { NextResponse } from "next/server";
import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { buildIceConfigFromEnv } from "@/lib/mobile/call-turn";

export const runtime = "nodejs";

/**
 * Config ICE pour WebRTC (TURN prioritaire + STUN + secours public).
 * Env:
 *   TURN_URLS=turn:turn.klambocore.com:3478,turns:turn.klambocore.com:443?transport=tcp
 *   TURN_SECRET=secret partagé avec coturn (use-auth-secret) — préféré
 *   TURN_TTL_SEC=3600
 *   TURN_USERNAME / TURN_CREDENTIAL — repli statique si pas de TURN_SECRET
 *   TURN_EXPAND_URLS=1 — ajoute TCP/443 à partir d'un seul 3478 (défaut)
 *   TURN_KEEP_PUBLIC_FALLBACK=1 — garde Metered derrière le TURN maison (défaut)
 *   TURN_FALLBACK_URLS / TURN_FALLBACK_SECRET — secours custom
 *   TURN_FORCE_RELAY=1 — le client force iceTransportPolicy:relay
 */
export async function GET() {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const built = buildIceConfigFromEnv({ userId: session.user.id });

    return jsonOk({
      iceServers: built.iceServers,
      callTimeoutMs: 45_000,
      preferRelay: built.preferRelay,
      source: built.source,
      ttlSec: built.ttlSec,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Config ICE indisponible.",
      500,
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
