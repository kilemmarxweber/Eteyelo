import { NextResponse } from "next/server";
import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  isValidMessagePublicKey,
  saveMessagePublicKey,
} from "@/lib/mobile/message-identity";

export const runtime = "nodejs";

/** Enregistre la clé publique de chiffrement des messages (X25519). */
export async function POST(request: Request) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);
    const body = (await request.json()) as { publicKey?: string };
    const publicKey = body.publicKey?.trim() ?? "";
    if (!isValidMessagePublicKey(publicKey)) {
      return jsonError("Clé publique invalide.", 400);
    }
    await saveMessagePublicKey(session.user.id, publicKey);
    return jsonOk({ publicKey });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Clé de message non enregistrée.",
      500,
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
