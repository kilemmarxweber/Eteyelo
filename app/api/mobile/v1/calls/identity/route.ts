import { NextResponse } from "next/server";
import {
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  isValidCallPublicKey,
  saveCallPublicKey,
} from "@/lib/mobile/call-identity";

export const runtime = "nodejs";

/** Enregistre la clé publique d'identité d'appel (Ed25519) du compte. */
export async function POST(request: Request) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);
    const body = (await request.json()) as { publicKey?: string };
    const publicKey = body.publicKey?.trim() ?? "";
    if (!isValidCallPublicKey(publicKey)) {
      return jsonError("Clé publique invalide.", 400);
    }
    await saveCallPublicKey(session.user.id, publicKey);
    return jsonOk({ publicKey });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Identité non enregistrée.",
      500,
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
