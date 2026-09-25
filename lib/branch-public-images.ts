import "server-only";

import {
  ensureUploadInSharedDirectory,
  uploadedFileExists,
} from "@/lib/upload-file.server";
import {
  getBranchImage,
  getPublicBranchPhotos,
  resolveBranchCoverSrc,
  type BranchImages,
} from "@/lib/utils";

export type ResolvedPublicBranchMedia = {
  logo?: string;
  cover?: string;
  gallery: string[];
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
 * Prépare logo / couverture / galerie pour les pages publiques :
 * - normalise les chemins
 * - migre public/uploads → dossier partagé si besoin
 * - ignore les fichiers absents du disque (évite les cases vides 404)
 * - couverture = photos école/galerie/événement, sinon logo
 */
export async function resolvePublicBranchMedia(
  image: unknown,
): Promise<ResolvedPublicBranchMedia> {
  const images = getBranchImage(image);
  const photoCandidates = getPublicBranchPhotos(images);
  const logoCandidate = images.logo;

  const [gallery, logoList] = await Promise.all([
    keepExistingUrls(photoCandidates),
    logoCandidate ? keepExistingUrls([logoCandidate]) : Promise.resolve([]),
  ]);

  const logo = logoList[0];
  const cover = gallery[0] || logo;

  return {
    logo,
    cover,
    gallery,
    images: {
      logo,
      ecole: images.ecole.filter((src) => gallery.includes(src)),
      gallery: images.gallery.filter((src) => gallery.includes(src)),
      event: images.event.filter((src) => gallery.includes(src)),
    },
  };
}

export async function resolvePublicBranchCover(
  image: unknown,
): Promise<string | undefined> {
  const media = await resolvePublicBranchMedia(image);
  return media.cover ?? resolveBranchCoverSrc(media.images);
}
