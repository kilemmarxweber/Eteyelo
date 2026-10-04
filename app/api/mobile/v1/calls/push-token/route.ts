import { NextResponse } from "next/server";
import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { saveCallPushToken } from "@/lib/mobile/call-push";

export const runtime = "nodejs";

/** Enregistre un jeton FCM/APNs pour réveiller l'app sur un appel. */
export async function POST(request: Request) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);
    const body = (await request.json()) as {
      token?: string;
      platform?: string;
    };
    const token = body.token?.trim() ?? "";
    const platform = body.platform === "ios" ? "ios" : "android";
    if (token.length < 8 || token.length > 4096) {
      return jsonError("Jeton push invalide.", 400);
    }
    await saveCallPushToken({
      userId: session.user.id,
      token,
      platform,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Jeton non enregistré.",
      500,
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
