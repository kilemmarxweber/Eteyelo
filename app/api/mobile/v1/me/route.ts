import {
  buildMePayload,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/upload-file.server";
import {
  mobileLocalUploadUrlSchema,
  mobileMePatchJsonSchema,
  mobileProfileNameSchema,
  zodErrorMessage,
} from "@/lib/mobile/messaging-schemas";

export const runtime = "nodejs";

const SESSION_SLIDE_MS = 60 * 60 * 24 * 30 * 1000; // 30 jours

/** Prolonge la session à chaque /me réussi (reste connecté). */
async function slideSession(token: string) {
  await prisma.session.updateMany({
    where: { token },
    data: { expiresAt: new Date(Date.now() + SESSION_SLIDE_MS) },
  });
}

function sanitizeOptionalName(value: unknown) {
  if (value == null || value === "") return undefined;
  const parsed = mobileProfileNameSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
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
      prenom?: string | null;
      postnom?: string | null;
      image?: string;
      activeOrganizationId?: string;
    } = {};

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const name = sanitizeOptionalName(String(form.get("name") ?? "").trim());
      const prenom = sanitizeOptionalName(
        String(form.get("prenom") ?? "").trim(),
      );
      const postnom = sanitizeOptionalName(
        String(form.get("postnom") ?? "").trim(),
      );
      if (name === null || prenom === null || postnom === null) {
        return jsonError("Caractères non autorisés dans le nom.", 400);
      }
      const activeOrganizationId = String(
        form.get("activeOrganizationId") ?? "",
      ).trim();
      if (name) data.name = name;
      if (prenom !== undefined) data.prenom = prenom;
      if (postnom !== undefined) data.postnom = postnom;
      if (activeOrganizationId) {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(activeOrganizationId)) {
          return jsonError("Organisation invalide.", 400);
        }
        data.activeOrganizationId = activeOrganizationId;
      }
      const file = form.get("image");
      if (file instanceof File && file.size > 0) {
        const saved = await saveUploadedFile(file);
        data.image = saved.url;
      }
    } else {
      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return jsonError("Corps JSON invalide.", 400);
      }
      const parsed = mobileMePatchJsonSchema.safeParse(raw);
      if (!parsed.success) {
        return jsonError(zodErrorMessage(parsed.error), 400);
      }
      Object.assign(data, parsed.data);
      if (data.image) {
        const img = mobileLocalUploadUrlSchema.safeParse(data.image);
        if (!img.success) {
          return jsonError("URL image non autorisée.", 400);
        }
      }
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
      prenom?: string | null;
      postnom?: string | null;
      image?: string;
    } = {};
    if (data.name) userUpdate.name = data.name.slice(0, 80);
    if (data.prenom !== undefined) userUpdate.prenom = data.prenom.slice(0, 80);
    if (data.postnom !== undefined) {
      userUpdate.postnom = data.postnom.slice(0, 80);
    }
    if (data.image && data.image.startsWith("/uploads/")) {
      userUpdate.image = data.image.slice(0, 300);
    }

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
