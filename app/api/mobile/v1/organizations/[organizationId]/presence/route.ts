import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { publishMobileEvent } from "@/lib/mobile/realtime";
import { MessagingError } from "@/lib/messaging/messaging-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ organizationId: string }> };

/** lastSeen jugé frais (heartbeat client ~25–30s). */
const ONLINE_TTL_MS = 120_000;

async function membershipOrgIds(userId: string) {
  const rows = await prisma.member.findMany({
    where: { userId, isArchived: false },
    select: { organizationId: true },
  });
  return rows.map((r) => r.organizationId);
}

/**
 * GET ?userIds=id1,id2 — en ligne si status ONLINE et lastSeen récent
 * (toutes orgs du membre : un user connecté à l’app l’est pour le chat).
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);

    const url = new URL(request.url);
    const raw = url.searchParams.get("userIds") ?? "";
    const requestedIds = raw
      .split(",")
      .map((s) => s.trim())
      .filter((id) => /^[a-zA-Z0-9_-]{1,64}$/.test(id))
      .slice(0, 50);

    if (requestedIds.length === 0) {
      return jsonOk({ items: [] });
    }

    // Uniquement les membres actifs de l'org (pas d'énumération cross-org).
    const orgMembers = await prisma.member.findMany({
      where: {
        organizationId,
        userId: { in: requestedIds },
        isArchived: false,
      },
      select: { userId: true },
    });
    const userIds = orgMembers.map((m) => m.userId);

    if (userIds.length === 0) {
      return jsonOk({ items: [] });
    }

    // Présence sur n’importe quelle org du user (évite faux « hors ligne »
    // quand activeOrganizationId ≠ org de la conversation).
    const rows = await prisma.userPresence.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        organizationId: true,
        status: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: "desc" },
    });

    const cutoff = Date.now() - ONLINE_TTL_MS;
    const bestByUser = new Map<
      string,
      { status: string; lastSeenAt: Date; online: boolean }
    >();

    for (const row of rows) {
      const fresh = row.lastSeenAt.getTime() >= cutoff;
      const online = row.status === "ONLINE" && fresh;
      const prev = bestByUser.get(row.userId);
      if (!prev || online || (!prev.online && row.lastSeenAt > prev.lastSeenAt)) {
        bestByUser.set(row.userId, {
          status: online ? "ONLINE" : "OFFLINE",
          lastSeenAt: row.lastSeenAt,
          online,
        });
      }
    }

    const allowed = new Set(userIds);
    const items = requestedIds.map((userId) => {
      if (!allowed.has(userId)) {
        return {
          userId,
          status: "OFFLINE" as const,
          lastSeenAt: null as string | null,
          online: false,
        };
      }
      const row = bestByUser.get(userId);
      if (!row) {
        return {
          userId,
          status: "OFFLINE" as const,
          lastSeenAt: null as string | null,
          online: false,
        };
      }
      return {
        userId,
        status: row.online ? ("ONLINE" as const) : ("OFFLINE" as const),
        lastSeenAt: row.lastSeenAt.toISOString(),
        online: row.online,
      };
    });

    return jsonOk({ items });
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Présence indisponible.",
      status,
    );
  }
}

/**
 * POST — heartbeat : marque l’utilisateur ONLINE sur toutes ses organisations.
 * Fonctionne même si le WebSocket est coupé (Chrome / proxy).
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId } = await context.params;
    await getMessagingActorFromSession(session, organizationId);

    const userId = session.user.id;
    const orgIds = await membershipOrgIds(userId);
    const targets = orgIds.length > 0 ? orgIds : [organizationId];
    const now = new Date();

    await Promise.all(
      targets.map(async (orgId) => {
        await prisma.userPresence.upsert({
          where: {
            userId_organizationId: { userId, organizationId: orgId },
          },
          create: {
            userId,
            organizationId: orgId,
            status: "ONLINE",
            lastSeenAt: now,
          },
          update: { status: "ONLINE", lastSeenAt: now },
        });
        // Ne pas bloquer le heartbeat sur Redis (sinon timeout client → ECONNRESET).
        void publishMobileEvent({
          type: "presence",
          organizationId: orgId,
          userId,
          status: "ONLINE",
        });
      }),
    );

    return jsonOk({ ok: true, organizations: targets.length });
  } catch (error) {
    const status = error instanceof MessagingError ? error.statusCode : 500;
    return jsonError(
      error instanceof Error ? error.message : "Heartbeat présence échoué.",
      status,
    );
  }
}
