import { NextResponse } from "next/server";
import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { readMessagePublicKey } from "@/lib/mobile/message-identity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ userId: string }> };

/** Clé publique de message d'un compte. Jamais la clé privée. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);
    const { userId } = await context.params;
    if (!userId) return jsonError("Utilisateur requis.", 400);
    const publicKey = await readMessagePublicKey(userId);
    if (!publicKey) return jsonError("Clé de message inconnue.", 404);
    return jsonOk({ userId, publicKey });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Clé de message indisponible.",
      500,
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
