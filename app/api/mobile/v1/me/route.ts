import {
  buildMePayload,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import {
  mobileIdSchema,
  mobileLocalUploadUrlSchema,
  mobileMePatchJsonSchema,
  mobileProfileNameSchema,
  zodErrorMessage,
} from "@/lib/mobile/messaging-schemas";
import { prisma } from "@/lib/prisma";
import { publicUploadPath, storedUploadFileName } from "@/lib/upload-paths";
import { saveUploadedFile } from "@/lib/upload-file.server";

export const runtime = "nodejs";

const SESSION_SLIDE_MS = 60 * 60 * 24 * 30 * 1000; // 30 jours

type MePatchData = {
  name?: string;
  prenom?: string | null;
  postnom?: string | null;
  image?: string;
  activeOrganizationId?: string;
};

/** Prolonge la session à chaque /me réussi (reste connecté). */
async function slideSession(token: string) {
  await prisma.session.updateMany({
    where: { token },
    data: { expiresAt: new Date(Date.now() + SESSION_SLIDE_MS) },
  });
}

/**
 * Nom affiché : absent → no-op ; vide → no-op ; invalide → erreur.
 */
function parseRequiredNameField(
  form: FormData,
  key: string,
): { ok: true; value?: string } | { ok: false; message: string } {
  if (!form.has(key)) return { ok: true };
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return { ok: true };
  const parsed = mobileProfileNameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorMessage(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Prénom / postnom : absent → no-op ; vide → null (efface) ; invalide → erreur.
 */
function parseNullableNameField(
  form: FormData,
  key: string,
): { ok: true; value?: string | null } | { ok: false; message: string } {
  if (!form.has(key)) return { ok: true };
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return { ok: true, value: null };
  const parsed = mobileProfileNameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorMessage(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Normalise toute URL d'upload locale acceptée vers `/uploads/...`. */
function normalizeLocalUploadUrl(url: string): string | null {
  const parsed = mobileLocalUploadUrlSchema.safeParse(url);
  if (!parsed.success) return null;
  const fileName = storedUploadFileName(parsed.data);
  return fileName ? publicUploadPath(fileName) : null;
}

function clipName(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value == null) return null;
  return value.slice(0, 80);
}

async function parseMultipartPatch(
  request: Request,
): Promise<{ ok: true; data: MePatchData } | { ok: false; response: Response }> {
  const form = await request.formData();
  const data: MePatchData = {};

  const name = parseRequiredNameField(form, "name");
  if (!name.ok) return { ok: false, response: jsonError(name.message, 400) };
  if (name.value) data.name = name.value;

  const prenom = parseNullableNameField(form, "prenom");
  if (!prenom.ok) return { ok: false, response: jsonError(prenom.message, 400) };
  if (prenom.value !== undefined) data.prenom = prenom.value;

  const postnom = parseNullableNameField(form, "postnom");
  if (!postnom.ok) {
    return { ok: false, response: jsonError(postnom.message, 400) };
  }
  if (postnom.value !== undefined) data.postnom = postnom.value;

  if (form.has("activeOrganizationId")) {
    const raw = String(form.get("activeOrganizationId") ?? "").trim();
    if (raw) {
      const orgId = mobileIdSchema.safeParse(raw);
      if (!orgId.success) {
        return { ok: false, response: jsonError("Organisation invalide.", 400) };
      }
      data.activeOrganizationId = orgId.data;
    }
  }

  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    const saved = await saveUploadedFile(file);
    const normalized = normalizeLocalUploadUrl(saved.url);
    if (!normalized) {
      return { ok: false, response: jsonError("URL image non autorisée.", 400) };
    }
    data.image = normalized;
  }

  return { ok: true, data };
}

async function parseJsonPatch(
  request: Request,
): Promise<{ ok: true; data: MePatchData } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: jsonError("Corps JSON invalide.", 400) };
  }

  const parsed = mobileMePatchJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(zodErrorMessage(parsed.error), 400),
    };
  }

  const data: MePatchData = { ...parsed.data };
  if (data.image) {
    const normalized = normalizeLocalUploadUrl(data.image);
    if (!normalized) {
      return { ok: false, response: jsonError("URL image non autorisée.", 400) };
    }
    data.image = normalized;
  }

  return { ok: true, data };
}

export async function GET() {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);
    await slideSession(session.session.token);
    return jsonOk(await buildMePayload(session));
  } catch (error) {
    console.error("MOBILE_ME_GET_ERROR", error);
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
    const parsed = contentType.includes("multipart/form-data")
      ? await parseMultipartPatch(request)
      : await parseJsonPatch(request);
    if (!parsed.ok) return parsed.response;

    const data = parsed.data;

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

    const name = clipName(data.name);
    if (typeof name === "string" && name.length > 0) userUpdate.name = name;

    if (data.prenom !== undefined) {
      userUpdate.prenom = clipName(data.prenom) ?? null;
    }
    if (data.postnom !== undefined) {
      userUpdate.postnom = clipName(data.postnom) ?? null;
    }
    if (data.image) {
      userUpdate.image = data.image.slice(0, 300);
    }

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: userUpdate,
      });
    }

    await slideSession(session.session.token);

    // Recharge la session pour refléter activeOrganizationId éventuel.
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
