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
  MOBILE_WS_CHANNEL,
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

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
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

      if (session.activeOrganizationId) {
        await prisma.userPresence.upsert({
          where: {
            userId_organizationId: {
              userId: session.userId,
              organizationId: session.activeOrganizationId,
            },
          },
          create: {
            userId: session.userId,
            organizationId: session.activeOrganizationId,
            status: "ONLINE",
            lastSeenAt: new Date(),
          },
          update: { status: "ONLINE", lastSeenAt: new Date() },
        });
      }

      ws.on("message", async (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as {
            type?: string;
            organizationId?: string;
            conversationId?: string;
            callId?: string;
            toUserId?: string;
            payload?: unknown;
          };

          if (msg.type === "ping") {
            send(ws, { type: "pong" });
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
            msg.type?.startsWith("call.") &&
            msg.organizationId &&
            msg.callId &&
            msg.toUserId
          ) {
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
        if (state.organizationId) {
          try {
            await prisma.userPresence.updateMany({
              where: {
                userId: state.userId,
                organizationId: state.organizationId,
              },
              data: { status: "OFFLINE", lastSeenAt: new Date() },
            });
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

  await ensureRedisReady();
  const sub = getRedisConnection().duplicate();
  await sub.connect().catch(() => undefined);
  await sub.subscribe(MOBILE_WS_CHANNEL);
  sub.on("message", (_channel, message) => {
    try {
      const event = JSON.parse(message) as MobileRealtimeEvent;
      if ("recipientUserIds" in event && Array.isArray(event.recipientUserIds)) {
        broadcastToUsers(event.recipientUserIds, event);
        return;
      }
      if ("toUserId" in event && typeof event.toUserId === "string") {
        broadcastToUsers([event.toUserId], event);
        return;
      }
      if (event.type === "presence") {
        for (const client of clients) {
          if (client.organizationId === event.organizationId) {
            send(client.ws, event);
          }
        }
      }
    } catch {
      // ignore
    }
  });

  async function broadcastAndPublish(
    event: MobileRealtimeEvent,
    except?: WebSocket,
  ) {
    if ("recipientUserIds" in event) {
      broadcastToUsers(event.recipientUserIds, event, except);
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
