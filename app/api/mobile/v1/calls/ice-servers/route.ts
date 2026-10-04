import { NextResponse } from "next/server";
import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { turnRestCredential } from "@/lib/mobile/call-turn";

export const runtime = "nodejs";

/**
 * Config ICE pour WebRTC (STUN public + TURN optionnel coturn).
 * Env:
 *   TURN_URLS=turn:turn.example.com:3478
 *   TURN_SECRET=secret partagé avec coturn (use-auth-secret) — préféré
 *   TURN_TTL_SEC=3600
 *   TURN_USERNAME / TURN_CREDENTIAL — repli statique si pas de TURN_SECRET
 */
export async function GET() {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const iceServers: Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }> = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];

    const turnUrls = process.env.TURN_URLS?.trim();
    const turnSecret = process.env.TURN_SECRET?.trim();
    const turnUser = process.env.TURN_USERNAME?.trim();
    const turnCred = process.env.TURN_CREDENTIAL?.trim();
    const urls = turnUrls
      ?.split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls && urls.length > 0 && turnSecret) {
      const ttl = Number(process.env.TURN_TTL_SEC ?? 3600);
      const creds = turnRestCredential({
        userId: session.user.id,
        secret: turnSecret,
        ttlSec: Number.isFinite(ttl) ? ttl : 3600,
      });
      iceServers.push({
        urls,
        username: creds.username,
        credential: creds.credential,
      });
    } else if (urls && urls.length > 0 && turnUser && turnCred) {
      iceServers.push({
        urls,
        username: turnUser,
        credential: turnCred,
      });
    }

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
