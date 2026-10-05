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
  getParentBulletinMeta,
  ParentMobileError,
} from "@/lib/parent/parent-mobile";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

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
    if (!studentId) return jsonError("studentId requis.", 400);
    const periodRaw = url.searchParams.get("periodId");
    const periodId =
      periodRaw != null && periodRaw.trim() !== ""
        ? Number(periodRaw)
        : undefined;
    if (periodId != null && !Number.isFinite(periodId)) {
      return jsonError("periodId invalide.", 400);
    }

    const data = await getParentBulletinMeta({
      userId: session.user.id,
      organizationId,
      studentId,
      periodId,
    });

    return jsonOk(data);
  } catch (error) {
    if (error instanceof ParentMobileError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(
      error instanceof Error ? error.message : "Erreur bulletin.",
      mobileErrorStatus(error),
    );
  }
}
