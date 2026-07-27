import type { Metadata } from "next";

import { SITE_NAME, SITE_OG_IMAGE, absoluteUrl } from "@/lib/seo/site";

type PublicPageMetaInput = {
  path: string;
  title: string;
  description: string;
  /** Si false, la page n’est pas indexée (ex. redirect legacy). */
  index?: boolean;
};

/** Métadonnées SEO réutilisables pour les pages marketing publiques. */
export function publicPageMetadata({
  path,
  title,
  description,
  index = true,
}: PublicPageMetaInput): Metadata {
  const url = absoluteUrl(path);

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
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [{ url: SITE_OG_IMAGE, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [SITE_OG_IMAGE],
    },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}
