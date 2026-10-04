/**
 * Serveur WebSocket messagerie mobile Klambo.
 * Partage Redis pub/sub avec Next (publishMobileEvent).
 *
 * Run: pnpm mobile:ws
 * Env: MOBILE_WS_PORT=3010 DATABASE_URL REDIS_URL BETTER_AUTH_SECRET
 */
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { prisma } from "../lib/prisma";
import {
  isCallSignalType,
  shouldMarkBusy,
} from "../lib/mobile/call-signaling-policy";
import {
  MOBILE_WS_CHANNEL,
  realtimeAudience,
  type MobileRealtimeEvent,
} from "../lib/mobile/realtime";
import {
  ensureRedisReady,
  getRedisConnection,
} from "../src/redis/redis";

type ClientState = {
  ws: WebSocket;
  userId: string;
  organizationId: string | null;
};

const clients = new Set<ClientState>();
const port = Number(process.env.MOBILE_WS_PORT ?? 3010);

/** Connexion jugée vivante si lastSeen < 120s (ping/heartbeat ~25–30s). */
const ONLINE_TTL_MS = 120_000;

async function authByToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      userId: true,
      expiresAt: true,
      activeOrganizationId: true,
      user: { select: { banned: true } },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.banned) return null;
  return session;
}

async function membershipOrgIds(userId: string) {
  const rows = await prisma.member.findMany({
    where: { userId, isArchived: false },
    select: { organizationId: true },
  });
  return rows.map((r) => r.organizationId);
}

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function isUserLive(userId: string) {
  for (const client of clients) {
    if (client.userId === userId && client.ws.readyState === client.ws.OPEN) {
      return true;
    }
  }
  return false;
}

function broadcastToUsers(
  userIds: string[],
  event: MobileRealtimeEvent,
  except?: WebSocket,
) {
  const set = new Set(userIds);
  for (const client of clients) {
    if (client.ws === except) continue;
    if (!set.has(client.userId)) continue;
    send(client.ws, event);
  }
}

function broadcastPresence(
  event: Extract<MobileRealtimeEvent, { type: "presence" }>,
) {
  // Diffuse à tous les clients de l’org OU qui n’ont pas encore d’org liée.
  for (const client of clients) {
    if (
      !client.organizationId ||
      client.organizationId === event.organizationId
    ) {
      send(client.ws, event);
    }
  }
}

async function publishPresence(
  organizationId: string,
  userId: string,
  status: "ONLINE" | "OFFLINE",
) {
  const event: MobileRealtimeEvent = {
    type: "presence",
    organizationId,
    userId,
    status,
  };
  broadcastPresence(event);
  try {
    const redis = getRedisConnection();
    await redis.publish(MOBILE_WS_CHANNEL, JSON.stringify(event));
  } catch {
    // ignore
  }
}

async function setPresence(
  userId: string,
  organizationId: string,
  status: "ONLINE" | "OFFLINE",
) {
  await prisma.userPresence.upsert({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    create: {
      userId,
      organizationId,
      status,
      lastSeenAt: new Date(),
    },
    update: { status, lastSeenAt: new Date() },
  });
  await publishPresence(organizationId, userId, status);
}

/** Marque ONLINE sur toutes les orgs du membre (évite faux hors-ligne cross-org). */
async function setPresenceAllOrgs(
  userId: string,
  status: "ONLINE" | "OFFLINE",
  preferredOrgId?: string | null,
) {
  const orgIds = await membershipOrgIds(userId);
  const targets =
    orgIds.length > 0
      ? orgIds
      : preferredOrgId
        ? [preferredOrgId]
        : [];
  await Promise.all(
    targets.map((orgId) => setPresence(userId, orgId, status)),
  );
}

async function touchPresenceAll(userId: string, preferredOrgId?: string | null) {
  const orgIds = await membershipOrgIds(userId);
  const targets =
    orgIds.length > 0
      ? orgIds
      : preferredOrgId
        ? [preferredOrgId]
        : [];
  if (targets.length === 0) return;
  const now = new Date();
  await prisma.userPresence.updateMany({
    where: { userId, organizationId: { in: targets } },
    data: { lastSeenAt: now, status: "ONLINE" },
  });
}

async function main() {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("klambo-mobile-ws ok");
  });

  const wss = new WebSocketServer({ server, path: "/api/mobile/ws" });

  wss.on("connection", async (ws, req) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        ws.close(4401, "token required");
        return;
      }
      const session = await authByToken(token);
      if (!session) {
        ws.close(4401, "unauthorized");
        return;
      }

      const state: ClientState = {
        ws,
        userId: session.userId,
        organizationId: session.activeOrganizationId,
      };
      clients.add(state);
      send(ws, { type: "connected", userId: session.userId });

      await setPresenceAllOrgs(
        session.userId,
        "ONLINE",
        session.activeOrganizationId,
      ).catch((e) => console.warn("[mobile-ws] presence on connect", e));

      ws.on("message", async (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as {
            type?: string;
            organizationId?: string;
            conversationId?: string;
            callId?: string;
            toUserId?: string;
            userIds?: string[];
            payload?: unknown;
          };

          if (msg.type === "ping") {
            await touchPresenceAll(state.userId, state.organizationId).catch(
              () => undefined,
            );
            send(ws, { type: "pong", at: Date.now() });
            return;
          }

          if (msg.type === "presence.subscribe" && msg.organizationId) {
            state.organizationId = msg.organizationId;
            await setPresenceAllOrgs(
              state.userId,
              "ONLINE",
              msg.organizationId,
            );
            return;
          }

          if (
            msg.type === "presence.query" &&
            msg.organizationId &&
            Array.isArray(msg.userIds)
          ) {
            const ids = msg.userIds.filter((id) => typeof id === "string");
            const rows = await prisma.userPresence.findMany({
              where: { userId: { in: ids } },
              select: {
                userId: true,
                status: true,
                lastSeenAt: true,
              },
              orderBy: { lastSeenAt: "desc" },
            });
            const cutoff = Date.now() - ONLINE_TTL_MS;
            const best = new Map<
              string,
              { status: string; lastSeenAt: Date }
            >();
            for (const r of rows) {
              if (!best.has(r.userId)) {
                best.set(r.userId, {
                  status: r.status,
                  lastSeenAt: r.lastSeenAt,
                });
              }
            }

            send(ws, {
              type: "presence.snapshot",
              organizationId: msg.organizationId,
              items: ids.map((userId) => {
                const live = isUserLive(userId);
                const row = best.get(userId);
                const fresh =
                  row != null && row.lastSeenAt.getTime() >= cutoff;
                const online =
                  live || (row?.status === "ONLINE" && fresh);
                return {
                  userId,
                  status: online ? "ONLINE" : "OFFLINE",
                  lastSeenAt: row?.lastSeenAt.toISOString() ?? null,
                  online,
                };
              }),
            });
            return;
          }

          if (msg.type === "typing" && msg.organizationId && msg.conversationId) {
            const participants = await prisma.conversationParticipant.findMany({
              where: {
                conversationId: msg.conversationId,
                leftAt: null,
              },
              select: { userId: true },
            });
            const event: MobileRealtimeEvent = {
              type: "typing",
              organizationId: msg.organizationId,
              conversationId: msg.conversationId,
              userId: state.userId,
              recipientUserIds: participants
                .map((p) => p.userId)
                .filter((id) => id !== state.userId),
            };
            await broadcastAndPublish(event, ws);
            return;
          }

          if (
            msg.type &&
            isCallSignalType(msg.type) &&
            msg.organizationId &&
            msg.callId &&
            msg.toUserId
          ) {
            if (msg.type === "call.busy") {
              const call = await prisma.callSession.findUnique({
                where: { id: msg.callId },
                select: { id: true, calleeId: true, status: true },
              });
              if (
                call &&
                shouldMarkBusy({
                  type: msg.type,
                  senderId: state.userId,
                  calleeId: call.calleeId,
                  status: call.status,
                })
              ) {
                // WHERE status=RINGING : évite d’écraser ACTIVE si un pair a déjà répondu.
                await prisma.callSession.updateMany({
                  where: {
                    id: call.id,
                    status: "RINGING",
                    calleeId: state.userId,
                  },
                  data: {
                    status: "REJECTED",
                    endedAt: new Date(),
                    endReason: "busy",
                  },
                });
              }
            }
            const event = {
              type: msg.type,
              organizationId: msg.organizationId,
              callId: msg.callId,
              fromUserId: state.userId,
              toUserId: msg.toUserId,
              payload: msg.payload,
            } as MobileRealtimeEvent;
            await broadcastAndPublish(event, ws);
          }
        } catch (error) {
          console.warn("[mobile-ws] bad message", error);
        }
      });

      ws.on("close", async () => {
        clients.delete(state);
        // Ne passe OFFLINE que s’il n’existe plus aucune autre socket pour ce user.
        if (!isUserLive(state.userId)) {
          try {
            await setPresenceAllOrgs(
              state.userId,
              "OFFLINE",
              state.organizationId,
            );
          } catch {
            // ignore
          }
        }
      });
    } catch (error) {
      console.error("[mobile-ws] connection error", error);
      ws.close(1011, "error");
    }
  });

  try {
    await ensureRedisReady();
    const sub = getRedisConnection().duplicate();
    await sub.connect();
    await sub.subscribe(MOBILE_WS_CHANNEL);
    sub.on("message", (_channel, message) => {
      try {
        const event = JSON.parse(message) as MobileRealtimeEvent;
        if ("recipientUserIds" in event && Array.isArray(event.recipientUserIds)) {
          broadcastToUsers(realtimeAudience(event), event);
          return;
        }
        if ("toUserId" in event && typeof event.toUserId === "string") {
          broadcastToUsers([event.toUserId], event);
          return;
        }
        if (event.type === "presence") {
          broadcastPresence(event);
        }
      } catch {
        // ignore
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[mobile-ws] Redis indisponible (${message}). Relais local uniquement.`,
    );
  }

  async function broadcastAndPublish(
    event: MobileRealtimeEvent,
    except?: WebSocket,
  ) {
    if ("recipientUserIds" in event) {
      broadcastToUsers(realtimeAudience(event), event, except);
    } else if ("toUserId" in event) {
      broadcastToUsers([event.toUserId], event, except);
    }
    try {
      const redis = getRedisConnection();
      await redis.publish(MOBILE_WS_CHANNEL, JSON.stringify(event));
    } catch {
      // ignore
    }
  }

  server.listen(port, () => {
    console.log(`[mobile-ws] listening on :${port}/api/mobile/ws`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
