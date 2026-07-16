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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <HomeNavbar />

      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 py-16 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <Badge className="bg-white/20 text-white">Établissements</Badge>

          <h1 className="mt-4 max-w-3xl text-4xl font-black md:text-6xl">
            Découvrez les écoles partenaires
          </h1>

          <p className="mt-5 max-w-7xl text-blue-50">
            Consultez les informations, photos, effectifs, références et
            services proposés par chaque établissement.
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
                <article className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-blue-100 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
                  <div
                    className="h-52 bg-cover bg-center transition duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: `url('${cover}')`,
                    }}
                  />

                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge className="bg-blue-100 text-blue-700">
                        <School className="mr-1 h-3 w-3" />
                        Partenaire
                      </Badge>

                      <ArrowRight className="h-5 w-5 text-blue-700 transition group-hover:translate-x-1" />
                    </div>

                    <h2 className="line-clamp-2 text-xl font-black text-blue-950">
                      {branch.name}
                    </h2>

                    <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                      <MapPin className="h-4 w-4 text-blue-700" />
                      {branch.adresse ||
                        branch.ville ||
                        branch.pays ||
                        "Adresse non renseignée"}
                    </p>

                    <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-950">
                      <Users className="h-4 w-4 text-blue-700" />
                      {studentsCount} élèves inscrits
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
