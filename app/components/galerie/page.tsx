import { Camera } from "lucide-react";

import { HomeNavbar } from "@/components/home-navbar";
import { HomeFooter } from "@/components/home-footer";
import { prisma } from "@/lib/prisma";
import { getBranchImage, normalizeImageSrc } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      image: true,
      ville: true,
      pays: true,
    },
  });

  const images = branches.flatMap((branch) => {
    const branchImages = getBranchImage(branch.image);

    return branchImages.gallery.map((image) => ({
      image: normalizeImageSrc(image),
      school: branch.name,
      city: branch.ville || branch.pays || "RDC",
    }));
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <HomeNavbar />

      <section className="border-b border-primary/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <Camera className="size-3.5" />
            Galerie
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Galerie photos
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/90 md:text-base">
            Photos des ecoles, evenements et activites partenaires.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {images.map((item, index) => (
            <article
              key={`${item.image}-${index}`}
              className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:border-primary/30"
            >
              <div
                className="aspect-square bg-cover bg-center transition duration-500 group-hover:scale-105"
                style={{
                  backgroundImage: `url('${item.image}')`,
                }}
              />

              <div className="p-4">
                <h2 className="line-clamp-1 text-sm font-bold text-foreground">
                  {item.school}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{item.city}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}
