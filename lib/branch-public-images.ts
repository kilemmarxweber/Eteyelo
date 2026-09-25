import "server-only";

import {
  ensureUploadInSharedDirectory,
  uploadedFileExists,
} from "@/lib/upload-file.server";
import {
  getBranchImage,
  type BranchImages,
} from "@/lib/utils";

export type ResolvedPublicBranchMedia = {
  /** Logo établissement — branding admin, pas les blocs photo publics. */
  logo?: string;
  /** Photos « École » — à la une / couverture établissement. */
  ecole: string[];
  /** Photos « Galerie » — uniquement le bloc galerie. */
  gallery: string[];
  /** Photos « Événements » branche — uniquement le bloc événements. */
  event: string[];
  /** Vidéos pub — uniquement la pub page d’accueil. */
  video: string[];
  /**
   * Couverture publique (à la une, fiche établissement) :
   * première photo école existante — jamais le logo.
   */
  cover?: string;
  images: BranchImages;
};

async function keepExistingUrls(urls: string[]): Promise<string[]> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  await Promise.all(unique.map((url) => ensureUploadInSharedDirectory(url)));

  const checks = await Promise.all(
    unique.map(async (url) => ({
      url,
      ok: await uploadedFileExists(url),
    })),
  );

  return checks.filter((item) => item.ok).map((item) => item.url);
}

/**
 * Sépare et valide les images de branche pour les pages publiques :
 * - ecole → à la une / cover
 * - gallery → galerie
 * - event → événements
 * - logo → jamais utilisé comme photo de contenu
 */
export async function resolvePublicBranchMedia(
  image: unknown,
): Promise<ResolvedPublicBranchMedia> {
  const images = getBranchImage(image);

  const [ecole, gallery, event, video, logoList] = await Promise.all([
    keepExistingUrls(images.ecole),
    keepExistingUrls(images.gallery),
    keepExistingUrls(images.event),
    keepExistingUrls(images.video),
    images.logo ? keepExistingUrls([images.logo]) : Promise.resolve([]),
  ]);

  const logo = logoList[0];
  const cover = ecole[0];

  return {
    logo,
    ecole,
    gallery,
    event,
    video,
    cover,
    images: {
      logo,
      ecole,
      gallery,
      event,
      video,
    },
  };
}

export async function resolvePublicBranchCover(
  image: unknown,
): Promise<string | undefined> {
  const media = await resolvePublicBranchMedia(image);
  return media.cover;
}
