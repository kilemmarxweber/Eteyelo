import {
  buildMePayload,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/upload-file.server";

export const runtime = "nodejs";

const SESSION_SLIDE_MS = 60 * 60 * 24 * 30 * 1000; // 30 jours

/** Prolonge la session à chaque /me réussi (reste connecté). */
async function slideSession(token: string) {
  await prisma.session.updateMany({
    where: { token },
    data: { expiresAt: new Date(Date.now() + SESSION_SLIDE_MS) },
  });
}

export async function GET() {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);
    await slideSession(session.session.token);
    const me = await buildMePayload(session);
    return jsonOk(me);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Erreur /me.",
      500,
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const contentType = request.headers.get("content-type") ?? "";
    const data: {
      name?: string;
      prenom?: string;
      postnom?: string;
      image?: string;
      activeOrganizationId?: string;
    } = {};

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const name = String(form.get("name") ?? "").trim();
      const prenom = String(form.get("prenom") ?? "").trim();
      const postnom = String(form.get("postnom") ?? "").trim();
      const activeOrganizationId = String(
        form.get("activeOrganizationId") ?? "",
      ).trim();
      if (name) data.name = name;
      if (prenom) data.prenom = prenom;
      if (postnom) data.postnom = postnom;
      if (activeOrganizationId) data.activeOrganizationId = activeOrganizationId;
      const file = form.get("image");
      if (file instanceof File && file.size > 0) {
        const saved = await saveUploadedFile(file);
        data.image = saved.url;
      }
    } else {
      Object.assign(data, await request.json());
    }

    if (data.activeOrganizationId) {
      const member = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: data.activeOrganizationId,
            userId: session.user.id,
          },
        },
        select: { id: true, isArchived: true },
      });
      if (!member || member.isArchived) {
        return jsonError("Organisation inaccessible.", 403);
      }
      await prisma.session.update({
        where: { token: session.session.token },
        data: { activeOrganizationId: data.activeOrganizationId },
      });
    }

    const userUpdate: {
      name?: string;
      prenom?: string;
      postnom?: string;
      image?: string;
    } = {};
    if (data.name) userUpdate.name = data.name;
    if (data.prenom !== undefined) userUpdate.prenom = data.prenom;
    if (data.postnom !== undefined) userUpdate.postnom = data.postnom;
    if (data.image) userUpdate.image = data.image;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: userUpdate,
      });
    }

    const fresh = requireSession(await getMobileSession());
    if (!fresh) return jsonError("Non authentifié.", 401);
    return jsonOk(await buildMePayload(fresh));
  } catch (error) {
    console.error("MOBILE_ME_PATCH_ERROR", error);
    return jsonError(
      error instanceof Error ? error.message : "Mise à jour échouée.",
      500,
    );
  }
}
