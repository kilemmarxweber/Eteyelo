import { NextResponse } from "next/server";
import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";

export const runtime = "nodejs";

/**
 * Config ICE pour WebRTC (STUN public + TURN optionnel coturn).
 * Env:
 *   TURN_URLS=turn:turn.example.com:3478
 *   TURN_USERNAME=klambo
 *   TURN_CREDENTIAL=secret
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
    const turnUser = process.env.TURN_USERNAME?.trim();
    const turnCred = process.env.TURN_CREDENTIAL?.trim();

    if (turnUrls && turnUser && turnCred) {
      iceServers.push({
        urls: turnUrls.split(",").map((u) => u.trim()).filter(Boolean),
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
