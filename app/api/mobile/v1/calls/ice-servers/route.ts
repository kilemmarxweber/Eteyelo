import { NextResponse } from "next/server";
import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { buildIceServers } from "@/lib/mobile/call-turn";

export const runtime = "nodejs";

/**
 * Config ICE pour WebRTC (STUN public + TURN maison ou relais public).
 * Env:
 *   TURN_URLS=turn:turn.example.com:3478
 *   TURN_SECRET=secret partagé avec coturn (use-auth-secret) — préféré
 *   TURN_TTL_SEC=3600
 *   TURN_USERNAME / TURN_CREDENTIAL — repli statique si pas de TURN_SECRET
 * Sans TURN_URLS : STUN publics (Google + Cloudflare) + Open Relay.
 */
export async function GET() {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const ttl = Number(process.env.TURN_TTL_SEC ?? 3600);
    const iceServers = buildIceServers({
      userId: session.user.id,
      turnUrls: process.env.TURN_URLS,
      turnSecret: process.env.TURN_SECRET,
      turnUser: process.env.TURN_USERNAME,
      turnCredential: process.env.TURN_CREDENTIAL,
      ttlSec: Number.isFinite(ttl) ? ttl : 3600,
    });

    return jsonOk({
      iceServers,
      callTimeoutMs: 45_000,
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
