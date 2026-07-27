import type { MetadataRoute } from "next";

import { DISALLOW_PATHS, SITE_URL } from "@/lib/seo/site";

/**
 * robots.txt généré — indexe le site public, bloque admin / auth / API.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOW_PATHS],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
