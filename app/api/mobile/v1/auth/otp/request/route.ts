import { normalizePhoneE164 } from "@/lib/mobile/phone";
import { requestMobileOtp } from "@/lib/mobile/otp";
import { jsonError, jsonOk } from "@/lib/mobile/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { phone?: string };
    const phone = normalizePhoneE164(body.phone ?? "");
    if (!phone) {
      return jsonError("Numéro de téléphone invalide.", 400);
    }

    const result = await requestMobileOtp(phone);
    // Toujours 200 pour ne pas fuiter l'existence du compte
    return jsonOk(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible d'envoyer le code.";
    const status = message.includes("Trop de demandes") ? 429 : 500;
    return jsonError(message, status);
  }
}
