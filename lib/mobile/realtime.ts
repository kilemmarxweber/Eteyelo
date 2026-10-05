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
      /** Aperçu pour notifs locales (WS). Jamais le clair d'un message chiffré. */
      bodyPreview?: string | null;
      /** Ciphertext complet, pour que le téléphone déchiffre l'aperçu. */
      bodyCipher?: string | null;
      senderName?: string | null;
      senderImage?: string | null;
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
      /** Qui a mis à jour la conversation (ex. lecture). */
      userId?: string;
      lastReadAt?: string;
      reason?: "read";
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
      type:
        | "call.offer"
        | "call.answer"
        | "call.ice"
        | "call.hangup"
        | "call.reject"
        | "call.ack"
        | "call.busy"
        | "call.renegotiate"
        | "call.restart-request";
      organizationId: string;
      callId: string;
      fromUserId: string;
      toUserId: string;
      payload?: unknown;
    };

/** Destinataires WS. L'expéditeur reçoit aussi ses messages, pour sa liste. */
export function realtimeAudience(event: MobileRealtimeEvent): string[] {
  if (!("recipientUserIds" in event)) {
    if ("toUserId" in event && event.toUserId) return [event.toUserId];
    return [];
  }
  const ids = [...event.recipientUserIds];
  if (
    (event.type === "message.created" ||
      event.type === "message.updated" ||
      event.type === "message.deleted") &&
    event.senderId &&
    !ids.includes(event.senderId)
  ) {
    ids.push(event.senderId);
  }
  return ids;
}

export async function publishMobileEvent(event: MobileRealtimeEvent) {
  const attempt = async () => {
    await ensureRedisReady(2000);
    const redis = getRedisConnection();
    if (redis.status !== "ready") {
      throw new Error(`Redis not ready (${redis.status})`);
    }
    // ping : détecte un socket « ready » mais déjà mort
    await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis ping timeout")), 1500),
      ),
    ]);
    await redis.publish(MOBILE_WS_CHANNEL, JSON.stringify(event));
  };

  try {
    await attempt();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown");
    const recoverable =
      /ECONNRESET|ECONNREFUSED|aborted|timeout|not ready|connection (is )?closed|connection ended|Redis connect|Redis ping/i.test(
        message,
      );
    if (recoverable) {
      try {
        const { resetRedisConnection } = await import("@/src/redis/redis");
        resetRedisConnection();
        await attempt();
        return;
      } catch (retryError) {
        const retryMsg =
          retryError instanceof Error
            ? retryError.message
            : String(retryError ?? "unknown");
        // Redis absent : message déjà en DB, inbox au prochain fetch HTTP.
        console.warn(
          `[mobile-realtime] push WS indisponible (Redis): ${retryMsg}`,
        );
        return;
      }
    }
    console.warn(`[mobile-realtime] publish failed: ${message}`);
  }
}
