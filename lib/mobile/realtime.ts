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
    await ensureRedisReady();
    const redis = getRedisConnection();
    await redis.publish(MOBILE_WS_CHANNEL, JSON.stringify(event));
  } catch (error) {
    console.warn("[mobile-realtime] publish failed", error);
  }
}
