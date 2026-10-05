import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  mobileErrorStatus,
  requireSession,
} from "@/lib/mobile/http";
import { splitOrgRoles } from "@/lib/messaging/messaging-policy";
import { ORG_ROLE } from "@/lib/permissions";
import {
  getParentStudentFees,
  ParentMobileError,
} from "@/lib/parent/parent-mobile";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

type Lang = "fr" | "en" | "pt";

function parseLang(raw: string | null): Lang {
  const v = raw?.trim().toLowerCase();
  if (v === "en" || v === "pt") return v;
  return "fr";
}

const INSTRUCTIONS: Record<Lang, string> = {
  fr: "Le paiement Mobile Money s’ouvrira bientôt depuis la fiche de frais.",
  en: "Mobile Money payment will open from the fee card soon.",
  pt: "O pagamento Mobile Money abrirá em breve a partir do cartão de propinas.",
};

export async function GET(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    const actor = await getMessagingActorFromSession(session, organizationId);
    if (!splitOrgRoles(actor.memberRole).includes(ORG_ROLE.PARENT)) {
      return jsonError("Réservé aux parents.", 403);
    }

    const url = new URL(request.url);
    const studentId = url.searchParams.get("studentId")?.trim();
    const fraisId = url.searchParams.get("fraisId")?.trim();
    const lang = parseLang(url.searchParams.get("lang"));

    if (!studentId) return jsonError("studentId requis.", 400);
    if (!fraisId) return jsonError("fraisId requis.", 400);

    // getParentStudentFees → assertParentOwnsStudent
    const feesData = await getParentStudentFees({
      userId: session.user.id,
      organizationId,
      studentId,
    });
    const fee = feesData.fees.find((f) => f.fraisId === fraisId);
    if (!fee) {
      return jsonError("Frais introuvable pour cet élève.", 404);
    }

    return jsonOk({
      available: false,
      provider: "pending" as const,
      deepLink: null,
      instructions: INSTRUCTIONS[lang],
      studentId,
      fraisId,
    });
  } catch (error) {
    if (error instanceof ParentMobileError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(
      error instanceof Error ? error.message : "Erreur lien de paiement.",
      mobileErrorStatus(error),
    );
  }
}
