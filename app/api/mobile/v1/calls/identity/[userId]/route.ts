import { NextResponse } from "next/server";
import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { readCallPublicKey } from "@/lib/mobile/call-identity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ userId: string }> };

/** Clé publique d'identité d'appel liée au compte (pas celle collée dans le SDP). */
export async function GET(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);
    const { userId } = await context.params;
    if (!userId) return jsonError("Utilisateur requis.", 400);
    const publicKey = await readCallPublicKey(userId);
    if (!publicKey) return jsonError("Identité d'appel inconnue.", 404);
    return jsonOk({ userId, publicKey });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Identité indisponible.",
      500,
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
