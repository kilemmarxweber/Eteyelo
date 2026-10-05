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
  listParentChildren,
  ParentMobileError,
} from "@/lib/parent/parent-mobile";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    const actor = await getMessagingActorFromSession(session, organizationId);
    if (!splitOrgRoles(actor.memberRole).includes(ORG_ROLE.PARENT)) {
      return jsonError("Réservé aux parents.", 403);
    }

    const children = await listParentChildren({
      userId: session.user.id,
      organizationId,
    });

    return jsonOk({ items: children });
  } catch (error) {
    if (error instanceof ParentMobileError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(
      error instanceof Error ? error.message : "Erreur enfants.",
      mobileErrorStatus(error),
    );
  }
}
