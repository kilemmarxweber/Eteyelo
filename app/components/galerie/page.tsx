// app/galerie/page.tsx
import { Camera } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { HomeNavbar } from "@/components/home-navbar";
import { HomeFooter } from "@/components/home-footer";
import { prisma } from "@/lib/prisma";
import { getBranchImage, normalizeImageSrc } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {};
export default async function GalleryPage(props: Props) {
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <HomeNavbar />

      <section className="bg-gradient-to-br from-blue-700 to-cyan-500 py-16 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <Badge className="bg-white/20 text-white">
            <Camera className="mr-1 h-3 w-3" />
            Galerie
          </Badge>
          <h1 className="mt-4 text-4xl font-black">Galerie photos</h1>
          <p className="mt-3 max-w-[300px] text-blue-50">
            Toutes les photos des écoles, événements et activités partenaires.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {images.map((item, index) => (
            <article
              key={`${item.image}-${index}`}
              className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-blue-100"
            >
              <div
                className="aspect-square bg-cover bg-center transition duration-500 group-hover:scale-105"
                style={{
                  backgroundImage: `url('${item.image}')`,
                }}
              />

              <div className="p-4">
                <h2 className="line-clamp-1 text-sm font-black text-blue-950">
                  {item.school}
                </h2>
                <p className="mt-1 text-xs text-slate-500">{item.city}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}
