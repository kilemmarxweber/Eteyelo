import {
  getMessagingActorFromSession,
  getMobileSession,
  jsonCreated,
  jsonError,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/upload-file.server";
import { publishMobileEvent } from "@/lib/mobile/realtime";
import type { MessageAttachmentKind } from "@/prisma/generated/prisma/client";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ organizationId: string; conversationId: string }>;
};

function kindFromMime(mime: string): MessageAttachmentKind {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime.startsWith("video/")) return "VIDEO";
  return "FILE";
}

/** Envoie un message média (multipart: file + body optionnel). */
export async function POST(request: Request, context: Ctx) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const { organizationId, conversationId } = await context.params;
    const actor = await getMessagingActorFromSession(session, organizationId);

    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: actor.userId,
        leftAt: null,
        conversation: { organizationId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!participant) return jsonError("Conversation inaccessible.", 404);

    const form = await request.formData();
    const file = form.get("file");
    const caption = String(form.get("body") ?? "").trim();
    const clientMessageId = String(form.get("clientMessageId") ?? "").trim() || null;

    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Fichier requis.", 400);
    }

    const saved = await saveUploadedFile(file);
    const kind = kindFromMime(file.type || "application/octet-stream");
    const bodyText = caption || `[${kind.toLowerCase()}]`;

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
          fileName: file.name,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return msg;
    });

    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    await publishMobileEvent({
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
    return jsonError(
      error instanceof Error ? error.message : "Upload média échoué.",
      500,
    );
  }
}
