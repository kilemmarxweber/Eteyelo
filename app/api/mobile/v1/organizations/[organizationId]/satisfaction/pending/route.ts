import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  mobileErrorStatus,
  requireSession,
} from "@/lib/mobile/http";
import {
  ensureMonthlySatisfactionDispatchForUser,
  listPendingBranchesForUser,
} from "@/lib/satisfaction/parent-satisfaction";
import { MessagingError } from "@/lib/messaging/messaging-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);
    const userId = session.user.id;

    // Rattrapage lazy: on prépare le message bot du mois à la 1re ouverture.
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
      error instanceof MessagingError ||
        (error instanceof Error && error.name === "MessagingError")
        ? (error as Error).message
        : "Erreur satisfaction.",
      mobileErrorStatus(error),
    );
  }
}
