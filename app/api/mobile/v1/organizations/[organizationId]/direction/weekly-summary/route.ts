import { canManageOrganization } from "@/lib/auth/session-roles";
import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  mobileErrorStatus,
  requireSession,
} from "@/lib/mobile/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

type Lang = "fr" | "en" | "pt";

function parseLang(raw: string | null | undefined): Lang {
  const v = raw?.trim().toLowerCase();
  if (v === "en" || v === "pt") return v;
  return "fr";
}

const MESSAGE: Record<Lang, string> = {
  fr: "Bientôt : résumé IA des avis de la semaine",
  en: "Coming soon: AI summary of this week’s notices",
  pt: "Em breve: resumo IA dos avisos da semana",
};

export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    const actor = await getMessagingActorFromSession(session, organizationId);

    if (!canManageOrganization(session, actor.memberRole, actor.appRole)) {
      return jsonError("Réservé à la direction.", 403);
    }

    let bodyLang: string | undefined;
    try {
      const body = (await request.json()) as { lang?: unknown };
      if (typeof body?.lang === "string") bodyLang = body.lang;
    } catch {
      // body optional
    }

    const url = new URL(request.url);
    const lang = parseLang(bodyLang ?? url.searchParams.get("lang"));

    return jsonOk({
      available: false,
      summary: null,
      message: MESSAGE[lang],
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Erreur résumé direction.",
      mobileErrorStatus(error),
    );
  }
}
