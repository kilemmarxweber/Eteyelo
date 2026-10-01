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
  ensureMonthlySatisfactionDispatchForUser,
  listPendingBranchesForUser,
} from "@/lib/satisfaction/parent-satisfaction";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    const actor = await getMessagingActorFromSession(session, organizationId);
    if (!splitOrgRoles(actor.memberRole).includes(ORG_ROLE.PARENT)) {
      return jsonError("La satisfaction est réservée aux parents.", 403);
    }

    const userId = session.user.id;

    await ensureMonthlySatisfactionDispatchForUser({
      userId,
      organizationId,
    });

    const pending = await listPendingBranchesForUser({
      userId,
      organizationId,
    });

    return jsonOk({
      month: pending.month,
      year: pending.calendarYear,
      label: pending.label,
      pending: pending.pendingItems.map((row) => ({
        parentId: row.parentId,
        branchId: row.branchId,
        branchName: row.branchName,
        schoolYearId: row.schoolYearId,
        children: row.children,
        status: row.status,
      })),
      all: pending.items.map((row) => ({
        parentId: row.parentId,
        branchId: row.branchId,
        branchName: row.branchName,
        schoolYearId: row.schoolYearId,
        children: row.children,
        status: row.status,
        rating: row.rating ?? null,
        feedbackSource: row.feedbackSource ?? null,
      })),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error && error.name === "MessagingError"
        ? error.message
        : "Erreur satisfaction.",
      mobileErrorStatus(error),
    );
  }
}
