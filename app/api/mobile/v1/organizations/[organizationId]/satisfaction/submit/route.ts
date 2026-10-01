import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  mobileErrorStatus,
  requireSession,
} from "@/lib/mobile/http";
import { MessagingError } from "@/lib/messaging/messaging-service";
import { submitParentSatisfaction } from "@/lib/satisfaction/parent-satisfaction";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);

    const body = (await request.json()) as {
      branchId?: string;
      rating?: number;
      comment?: string | null;
    };
    if (!body.branchId?.trim()) {
      return jsonError("Branche manquante.", 400);
    }

    const result = await submitParentSatisfaction({
      userId: session.user.id,
      organizationId,
      branchId: body.branchId.trim(),
      rating: Number(body.rating),
      comment: body.comment ?? null,
      source: "KLAMBO",
    });

    if ("error" in result) {
      const status = result.error === "ALREADY_SUBMITTED" ? 409 : 400;
      return jsonError(result.error ?? "Soumission impossible.", status);
    }

    return jsonOk({
      feedback: result.data,
    });
  } catch (error) {
    return jsonError(
      error instanceof MessagingError ||
        (error instanceof Error && error.name === "MessagingError")
        ? (error as Error).message
        : "Soumission impossible.",
      mobileErrorStatus(error),
    );
  }
}
