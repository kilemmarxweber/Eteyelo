import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { PUBLIC_STATIC_ROUTES, absoluteUrl } from "@/lib/seo/site";

/**
 * Sitemap : pages marketing + fiches établissements actives.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_STATIC_ROUTES.map(
    (route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }),
  );

  let establishmentEntries: MetadataRoute.Sitemap = [];

  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    establishmentEntries = branches.map((branch) => ({
      url: absoluteUrl(`/etablissements/${branch.id}`),
      lastModified: branch.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // Build / preview sans DB : le sitemap reste valide avec les routes statiques.
  }

  return [...staticEntries, ...establishmentEntries];
}
