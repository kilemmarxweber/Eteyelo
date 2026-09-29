import {
  buildMePayload,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { revokeMobileSession } from "@/lib/mobile/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : session.session.token;

    if (token) {
      await revokeMobileSession(token);
    }

    return jsonOk({ signedOut: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Déconnexion échouée.",
      500,
    );
  }
}
