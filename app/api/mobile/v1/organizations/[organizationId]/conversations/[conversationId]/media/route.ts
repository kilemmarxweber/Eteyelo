import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonCreated,
  jsonError,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { saveMessagingUpload } from "@/lib/upload-file.server";
import { publishMobileEvent } from "@/lib/mobile/realtime";
import {
  canSendMessages,
  messagingDeniedMessage,
} from "@/lib/messaging/messaging-policy";
import { MessagingError } from "@/lib/messaging/messaging-service";
import {
  MESSAGING_MAX_BODY_LENGTH,
  MESSAGING_RATE_LIMIT_PER_MINUTE,
  sanitizeMessageBody,
} from "@/lib/messaging/messaging-types";
import type { MessageAttachmentKind } from "@/prisma/generated/prisma/client";
import path from "node:path";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ organizationId: string; conversationId: string }>;
};

function kindFromFile(file: File): MessageAttachmentKind | null {
  const mime = (file.type || "").toLowerCase();
  const ext = path.extname(file.name).toLowerCase();
  if (
    mime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)
  ) {
    return "IMAGE";
  }
  if (
    mime.startsWith("audio/") ||
    [".mp3", ".m4a", ".aac", ".wav", ".ogg"].includes(ext)
  ) {
    return "AUDIO";
  }
  if (mime.startsWith("video/") || ext === ".mp4") {
    return "VIDEO";
  }
  if (ext === ".webm") {
    return mime.startsWith("video/") ? "VIDEO" : "AUDIO";
  }
  if (
    mime === "application/pdf" ||
    [".pdf", ".doc", ".docx"].includes(ext)
  ) {
    return "FILE";
  }
  return null;
}

/** Envoie un message média (multipart: file + body optionnel). */
export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, conversationId } = await context.params;
    const actor = await getMessagingActorFromSession(session, organizationId);

    if (
      !canSendMessages({
        appRole: actor.appRole,
        memberRole: actor.memberRole,
        memberArchived: actor.memberArchived,
        userBanned: actor.userBanned,
        organizationMessagingEnabled: actor.messagingEnabled,
      })
    ) {
      return jsonError(messagingDeniedMessage("send"), 403);
    }

    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: actor.userId,
        leftAt: null,
        conversation: { organizationId, deletedAt: null },
      },
      select: {
        id: true,
        role: true,
        conversation: {
          select: {
            type: true,
            repliesLocked: true,
            createdById: true,
          },
        },
      },
    });
    if (!participant) return jsonError("Conversation inaccessible.", 404);

    if (
      participant.conversation.type === "GROUP" &&
      participant.conversation.repliesLocked
    ) {
      const isAdmin =
        participant.role === "ADMIN" ||
        participant.conversation.createdById === actor.userId;
      if (!isAdmin) {
        return jsonError(
          "Les réponses sont verrouillées : seuls les admins du groupe peuvent écrire.",
          403,
        );
      }
    }

    const form = await request.formData();
    const file = form.get("file");
    const captionRaw = String(form.get("body") ?? "");
    const caption = sanitizeMessageBody(captionRaw);
    const clientMessageId =
      String(form.get("clientMessageId") ?? "").trim().slice(0, 80) || null;

    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Fichier requis.", 400);
    }
    if (caption.length > MESSAGING_MAX_BODY_LENGTH) {
      return jsonError("Légende trop longue.", 400);
    }

    if (clientMessageId) {
      const existing = await prisma.message.findFirst({
        where: { senderId: actor.userId, clientMessageId },
        select: { id: true, conversationId: true },
      });
      if (existing) {
        return jsonCreated({
          messageId: existing.id,
          conversationId: existing.conversationId,
          reused: true,
        });
      }
    }

    const kind = kindFromFile(file);
    if (!kind) {
      return jsonError(
        "Format non autorisé. Utilisez une image, un PDF, un audio ou une vidéo.",
        400,
      );
    }

    const recent = await prisma.message.count({
      where: {
        senderId: actor.userId,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recent >= MESSAGING_RATE_LIMIT_PER_MINUTE) {
      return jsonError("Trop de messages envoyés. Réessayez dans une minute.", 429);
    }

    const saved = await saveMessagingUpload(file);
    const durationRaw = String(form.get("durationMs") ?? "").trim();
    const durationParsed = durationRaw ? Number.parseInt(durationRaw, 10) : NaN;
    const durationMs =
      Number.isFinite(durationParsed) && durationParsed > 0 && durationParsed < 86_400_000
        ? durationParsed
        : null;
    const bodyText = caption || `[${kind.toLowerCase()}]`;
    const safeFileName = path.basename(file.name).slice(0, 180) || null;

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderId: actor.userId,
          body: bodyText,
          clientMessageId,
        },
      });
      await tx.messageAttachment.create({
        data: {
          messageId: msg.id,
          kind,
          url: saved.url,
          mimeType: file.type || null,
          sizeBytes: file.size,
          durationMs,
          fileName: safeFileName,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      await tx.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: actor.userId,
          },
        },
        data: { lastReadAt: new Date(), archivedAt: null },
      });
      return msg;
    });

    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    void publishMobileEvent({
      type: "message.created",
      organizationId,
      conversationId,
      messageId: message.id,
      senderId: actor.userId,
      recipientUserIds: participants.map((p) => p.userId),
    });

    return jsonCreated({
      messageId: message.id,
      conversationId,
      attachmentUrl: saved.url,
      kind,
    });
  } catch (error) {
    console.error("MOBILE_MEDIA_ERROR", error);
    if (error instanceof MessagingError) {
      return jsonError(error.message, 400);
    }
    const message =
      error instanceof Error ? error.message : "Upload média échoué.";
    const safe =
      /non autorisé|vide|taille|format|trop/i.test(message)
        ? message
        : "Upload média échoué.";
    return jsonError(safe, 500);
  }
}
