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
      name = String(form.get("name") ?? "").trim() || undefined;
      prenom = String(form.get("prenom") ?? "").trim() || undefined;
      postnom = String(form.get("postnom") ?? "").trim() || undefined;
      const file = form.get("image");
      if (file instanceof File && file.size > 0) {
        const saved = await saveUploadedFile(file);
        imageUrl = saved.url;
      }
    } else {
      const body = (await request.json()) as {
        name?: string;
        prenom?: string;
        postnom?: string;
        image?: string;
      };
      name = body.name?.trim() || undefined;
      prenom = body.prenom?.trim() || undefined;
      postnom = body.postnom?.trim() || undefined;
      imageUrl = body.image?.trim() || undefined;
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
