import { normalizePhoneE164 } from "@/lib/mobile/phone";
import { verifyMobileOtp } from "@/lib/mobile/otp";
import {
  createMobileSession,
  ensureUserForPhone,
  isProfileComplete,
} from "@/lib/mobile/session";
import { buildMePayload, jsonError, jsonOk } from "@/lib/mobile/http";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { phone?: string; code?: string };
    const phone = normalizePhoneE164(body.phone ?? "");
    const code = (body.code ?? "").trim();

    if (!phone) {
      return jsonError("Numéro de téléphone invalide.", 400);
    }
    if (!/^\d{6}$/.test(code)) {
      return jsonError("Code OTP invalide.", 400);
    }

    await verifyMobileOtp(phone, code);
    const user = await ensureUserForPhone(phone);

    if (user.banned) {
      return jsonError("Compte suspendu.", 403);
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent");

    const session = await createMobileSession({
      userId: user.id,
      ipAddress: ip,
      userAgent,
    });

    // Session Better Auth via Bearer pour les appels suivants
    const h = new Headers(await headers());
    h.set("authorization", `Bearer ${session.token}`);

    const authSession = await auth.api.getSession({ headers: h });
    const me = authSession
      ? await buildMePayload(authSession)
      : {
          user: {
            id: user.id,
            name: user.name,
            prenom: user.prenom,
            postnom: user.postnom,
            image: user.image,
            telephone: user.telephone ?? phone,
            email: user.email,
            role: user.role,
          },
          profileComplete: isProfileComplete(user),
          needsOnboarding: !isProfileComplete(user),
          activeOrganizationId: session.activeOrganizationId,
          organizations: [],
          messagingEnabledForActiveOrg: false,
        };

    return jsonOk(
      {
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
        ...me,
      },
      {
        headers: {
          "set-auth-token": session.token,
          "Access-Control-Expose-Headers": "set-auth-token",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vérification échouée.";
    const status = message.includes("incorrect") ? 401 : 500;
    return jsonError(message, status);
  }
}
