import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/upload-file.server";
import {
  buildMePayload,
  getMobileSession,
  jsonError,
  jsonOk,
  requireSession,
} from "@/lib/mobile/http";
import { isProfileComplete } from "@/lib/mobile/session";
import {
  mobileLocalUploadUrlSchema,
  mobileProfileNameSchema,
  zodErrorMessage,
} from "@/lib/mobile/messaging-schemas";

export const runtime = "nodejs";

/**
 * Complète le profil après OTP (nom + photo si manquants).
 * Accepte JSON ou multipart (file + champs).
 */
export async function POST(request: Request) {
  try {
    const session = requireSession(await getMobileSession());
    if (!session) return jsonError("Non authentifié.", 401);

    const contentType = request.headers.get("content-type") ?? "";
    let name: string | undefined;
    let prenom: string | undefined;
    let postnom: string | undefined;
    let imageUrl: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const nameParsed = mobileProfileNameSchema.safeParse(
        String(form.get("name") ?? "").trim() || undefined,
      );
      const prenomParsed = mobileProfileNameSchema.safeParse(
        String(form.get("prenom") ?? "").trim() || undefined,
      );
      const postnomParsed = mobileProfileNameSchema.safeParse(
        String(form.get("postnom") ?? "").trim() || undefined,
      );
      // Champs absents OK ; présents invalides → 400
      if (
        (form.get("name") && !nameParsed.success) ||
        (String(form.get("prenom") ?? "").trim() && !prenomParsed.success) ||
        (String(form.get("postnom") ?? "").trim() && !postnomParsed.success)
      ) {
        return jsonError("Caractères non autorisés dans le nom.", 400);
      }
      name = nameParsed.success ? nameParsed.data : undefined;
      prenom = prenomParsed.success ? prenomParsed.data : undefined;
      postnom = postnomParsed.success ? postnomParsed.data : undefined;
      const file = form.get("image");
      if (file instanceof File && file.size > 0) {
        const saved = await saveUploadedFile(file);
        imageUrl = saved.url;
      }
    } else {
      let body: {
        name?: string;
        prenom?: string;
        postnom?: string;
        image?: string;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return jsonError("Corps JSON invalide.", 400);
      }
      if (body.name != null) {
        const p = mobileProfileNameSchema.safeParse(body.name.trim());
        if (!p.success) return jsonError(zodErrorMessage(p.error), 400);
        name = p.data;
      }
      if (body.prenom != null && body.prenom.trim()) {
        const p = mobileProfileNameSchema.safeParse(body.prenom.trim());
        if (!p.success) return jsonError(zodErrorMessage(p.error), 400);
        prenom = p.data;
      }
      if (body.postnom != null && body.postnom.trim()) {
        const p = mobileProfileNameSchema.safeParse(body.postnom.trim());
        if (!p.success) return jsonError(zodErrorMessage(p.error), 400);
        postnom = p.data;
      }
      if (body.image?.trim()) {
        const img = mobileLocalUploadUrlSchema.safeParse(body.image.trim());
        if (!img.success) {
          return jsonError("URL image non autorisée.", 400);
        }
        imageUrl = img.data;
      }
    }

    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        prenom: true,
        postnom: true,
        image: true,
        telephone: true,
      },
    });

    if (!current) return jsonError("Utilisateur introuvable.", 404);

    const nextPrenom = prenom ?? current.prenom;
    const nextPostnom = postnom ?? current.postnom;
    const nextImage = imageUrl ?? current.image;
    const displayName =
      name ||
      [nextPrenom, nextPostnom].filter(Boolean).join(" ").trim() ||
      current.name;

    if (!displayName || displayName.startsWith("+")) {
      return jsonError("Le nom est obligatoire.", 400);
    }
    if (!nextImage) {
      return jsonError("La photo de profil est obligatoire.", 400);
    }
    // Image déjà en base : doit rester un upload local si fournie via JSON.
    if (
      imageUrl == null &&
      nextImage &&
      !mobileLocalUploadUrlSchema.safeParse(nextImage).success &&
      !nextImage.startsWith("/api/uploads/")
    ) {
      // Anciennes images externes : on laisse si déjà stockées, mais refuse injection nouvelle.
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: displayName,
        prenom: nextPrenom,
        postnom: nextPostnom,
        image: nextImage,
      },
    });

    const me = await buildMePayload(session);
    return jsonOk({
      ...me,
      profileComplete: isProfileComplete({
        name: displayName,
        prenom: nextPrenom,
        image: nextImage,
      }),
      needsOnboarding: false,
    });
  } catch (error) {
    console.error("MOBILE_PROFILE_ERROR", error);
    return jsonError(
      error instanceof Error ? error.message : "Mise à jour profil échouée.",
      500,
    );
  }
}
