import { ensureRedisReady, getRedisConnection } from "@/src/redis/redis";

export const MOBILE_WS_CHANNEL = "klambo:mobile:events";

export type MobileRealtimeEvent =
  | {
      type: "message.created";
      organizationId: string;
      conversationId: string;
      messageId: string;
      senderId: string;
      recipientUserIds: string[];
    }
  | {
      type: "message.updated";
      organizationId: string;
      conversationId: string;
      messageId: string;
      senderId: string;
      recipientUserIds: string[];
    }
  | {
      type: "message.deleted";
      organizationId: string;
      conversationId: string;
      messageId: string;
      senderId: string;
      recipientUserIds: string[];
    }
  | {
      type: "conversation.updated";
      organizationId: string;
      conversationId: string;
      recipientUserIds: string[];
    }
  | {
      type: "typing";
      organizationId: string;
      conversationId: string;
      userId: string;
      recipientUserIds: string[];
    }
  | {
      type: "presence";
      organizationId: string;
      userId: string;
      status: "ONLINE" | "OFFLINE";
    }
  | {
      type: "call.offer" | "call.answer" | "call.ice" | "call.hangup" | "call.reject";
      organizationId: string;
      callId: string;
      fromUserId: string;
      toUserId: string;
      payload?: unknown;
    };

export async function publishMobileEvent(event: MobileRealtimeEvent) {
  try {
    await ensureRedisReady(1500);
    const redis = getRedisConnection();
    if (redis.status !== "ready") {
      throw new Error("Redis not ready");
    }
    await redis.publish(MOBILE_WS_CHANNEL, JSON.stringify(event));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown");
    // Redis down / client abort : présence/API OK, seul le push WS est perdu.
    if (
      !/ECONNRESET|ECONNREFUSED|aborted|timeout|not ready|connection ended/i.test(
        message,
      )
    ) {
      console.warn(`[mobile-realtime] publish failed: ${message}`);
    }
  }
}
