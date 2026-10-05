/**
 * Webhook inbound SMS (provider → Eteyelo).
 * Si le texte matche OK/1/oui/yes/sim → tente NoticeAck sur le dernier avis
 * critique non acquitté lié au numéro (best-effort).
 *
 * Auth optionnelle : header `x-sms-inbound-secret` === SMS_INBOUND_SECRET
 * (si l’env est défini). Sinon ouvert (stub P3).
 *
 * TODO: lier l’ack au messageId exact envoyé par SMS (corrélation outbound),
 * et restreindre aux orgs / messages marqués smsCritical.
 */

import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/mobile/http";
import { findUserByTelephone } from "@/lib/mobile/session";
import { normalizePhoneE164, maskPhone } from "@/lib/mobile/phone";
import {
  isCriticalSmsAckText,
} from "@/lib/notify/critical-sms";
import {
  NOTIFY_MESSAGE_PREFIX,
  parseNotifyCard,
} from "@/lib/notify/notify-message-card";
import { acknowledgeNotice } from "@/lib/notify/notice-ack";

export const runtime = "nodejs";

function authorizeInbound(request: Request): boolean {
  const expected = process.env.SMS_INBOUND_SECRET?.trim();
  if (!expected) return true;
  const got =
    request.headers.get("x-sms-inbound-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return got === expected;
}

async function findLatestUnackedCriticalNotice(userId: string): Promise<{
  messageId: string;
  organizationId: string;
} | null> {
  const candidates = await prisma.message.findMany({
    where: {
      deletedAt: null,
      body: { startsWith: NOTIFY_MESSAGE_PREFIX },
      conversation: {
        deletedAt: null,
        participants: {
          some: { userId, leftAt: null },
        },
      },
      noticeAcks: { none: { userId } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      body: true,
      conversation: { select: { organizationId: true } },
    },
  });

  for (const row of candidates) {
    const card = parseNotifyCard(row.body);
    if (card?.tone === "rose") {
      return {
        messageId: row.id,
        organizationId: row.conversation.organizationId,
      };
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    if (!authorizeInbound(request)) {
      return jsonError("Non autorisé.", 401);
    }

    const body = (await request.json()) as {
      from?: string;
      text?: string;
      body?: string;
    };
    const fromRaw = body.from?.trim() ?? "";
    const text = (body.text ?? body.body ?? "").trim();
    const from = normalizePhoneE164(fromRaw);

    if (!from || !text) {
      return jsonError("from et text requis.", 400);
    }

    const matched = isCriticalSmsAckText(text);
    // eslint-disable-next-line no-console
    console.info(
      `[sms-inbound] from=${maskPhone(from)} matched=${matched} text=${text.slice(0, 40)}`,
    );

    if (!matched) {
      return jsonOk({ matched: false, acked: false });
    }

    const user = await findUserByTelephone(from);
    if (!user) {
      // TODO: numéro inconnu — corrélation outbound / mapping temporaire
      return jsonOk({
        matched: true,
        acked: false,
        reason: "user_not_found",
      });
    }

    const notice = await findLatestUnackedCriticalNotice(user.id);
    if (!notice) {
      return jsonOk({
        matched: true,
        acked: false,
        reason: "no_pending_critical_notice",
      });
    }

    try {
      const ack = await acknowledgeNotice({
        organizationId: notice.organizationId,
        messageId: notice.messageId,
        userId: user.id,
      });
      return jsonOk({
        matched: true,
        acked: true,
        messageId: ack.messageId,
        ackCount: ack.ackCount,
      });
    } catch (ackError) {
      // eslint-disable-next-line no-console
      console.warn(
        `[sms-inbound] ack failed: ${
          ackError instanceof Error ? ackError.message : String(ackError)
        }`,
      );
      // Fallback documenté : matched sans lien ack fiable
      return jsonOk({
        matched: true,
        acked: false,
        reason: "ack_failed",
        // TODO: retry / file d’attente inbound
      });
    }
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Webhook SMS invalide.",
      400,
    );
  }
}
