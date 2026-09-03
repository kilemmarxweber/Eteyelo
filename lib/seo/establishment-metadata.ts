import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { absoluteUrl, SITE_NAME, SITE_OG_IMAGE } from "@/lib/seo/site";
import { firstPublicBranchPhoto, getBranchImage } from "@/lib/utils";

export type EstablishmentSeoBranch = {
  id: string;
  name: string;
  ville: string | null;
  pays: string | null;
  adresse: string | null;
  note: string | null;
  isActive: boolean;
  image: unknown;
  organization: { name: string } | null;
};

export async function getEstablishmentSeoBranch(
  branchId: string,
): Promise<EstablishmentSeoBranch | null> {
  return prisma.branch.findFirst({
    where: { id: branchId },
    select: {
      id: true,
      name: true,
      ville: true,
      pays: true,
      adresse: true,
      note: true,
      isActive: true,
      image: true,
      organization: {
        select: { name: true },
      },
    },
  });
}

function locationLabel(branch: EstablishmentSeoBranch): string {
  return [branch.ville, branch.pays].filter(Boolean).join(", ");
}

function coverImage(branch: EstablishmentSeoBranch): string {
  const images = getBranchImage(branch.image);
  return firstPublicBranchPhoto(images) || SITE_OG_IMAGE;
}

function buildDescription(branch: EstablishmentSeoBranch): string {
  const location = locationLabel(branch);
  const org = branch.organization?.name;

  if (branch.note?.trim()) {
    const note = branch.note.trim().replace(/\s+/g, " ");
    return note.length > 155 ? `${note.slice(0, 152)}…` : note;
  }

  const parts = [
    `${branch.name}${location ? ` — ${location}` : ""}`,
    org ? `Établissement de ${org}` : null,
    "Présentation, contacts et informations sur KlamboCore.",
  ].filter(Boolean);

  return parts.join(". ");
}

export function buildEstablishmentMetadata(
  branch: EstablishmentSeoBranch,
): Metadata {
  const location = locationLabel(branch);
  const title = location ? `${branch.name} — ${location}` : branch.name;
  const description = buildDescription(branch);
  const path = `/etablissements/${branch.id}`;
  const url = absoluteUrl(path);
  const image = coverImage(branch);
  const indexable = branch.isActive;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      locale: "fr_CD",
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: image,
          alt: branch.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}
