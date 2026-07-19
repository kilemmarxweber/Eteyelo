import Link from "next/link";
import { ArrowRight, MapPin, School, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { HomeFooter } from "@/components/home-footer";
import { HomeNavbar } from "@/components/home-navbar";
import { prisma } from "@/lib/prisma";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { getBranchImage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EtablissementsPage() {
  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      adresse: true,
      ville: true,
      pays: true,
      image: true,
      branchemembers: {
        select: {
          _count: {
            select: {
              student: true,
            },
          },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <HomeNavbar />

      <section className="border-b border-primary/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <School className="size-3.5" />
            Etablissements
          </div>

          <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">
            Decouvrez les ecoles partenaires
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-primary-foreground/90 md:text-base">
            Consultez les informations, photos, effectifs et services proposes
            par chaque etablissement.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => {
            const images = getBranchImage(branch.image);
            const cover =
              images.ecole[0] ||
              images.event[0] ||
              images.gallery[0] ||
              images.logo ||
              KLAMBOCORE_DEFAULT_IMAGE_PATH;

            const studentsCount = branch.branchemembers.reduce(
              (total, member) => total + member._count.student,
              0,
            );

            return (
              <Link key={branch.id} href={`/etablissements/${branch.id}`}>
                <article className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div
                    className="h-52 bg-cover bg-center transition duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: `url('${cover}')`,
                    }}
                  />

                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        <School className="mr-1 size-3" />
                        Partenaire
                      </Badge>

                      <ArrowRight className="size-5 text-primary transition group-hover:translate-x-1" />
                    </div>

                    <h2 className="line-clamp-2 text-xl font-bold text-foreground">
                      {branch.name}
                    </h2>

                    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4 text-primary" />
                      {branch.adresse ||
                        branch.ville ||
                        branch.pays ||
                        "Adresse non renseignee"}
                    </p>

                    <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary/5 px-3 py-2 text-sm font-semibold text-foreground">
                      <Users className="size-4 text-primary" />
                      {studentsCount} eleves inscrits
                    </p>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </section>

      <HomeFooter />
    </main>
  );
}
