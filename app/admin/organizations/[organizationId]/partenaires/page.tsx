import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Mail,
  MapPin,
  Plus,
  Search,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { normalizeImageSrc } from "@/lib/utils";
import { PartenaireActions } from "./partenaire-actions";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function OrganizationPartenairesPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId } = await params;
  const { q } = await searchParams;

  const partenaires = await prisma.partnaire.findMany({
    where: {
      OR: [
        {
          branch: {
            organizationId,
          },
        },
        {
          branchId: null,
        },
      ],
      ...(q
        ? {
            name: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      secteur: true,
      image: true,
      logo: true,
      email: true,
      website: true,
      ville: true,
      pays: true,
      isActive: true,
      isFeatured: true,
      branch: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl bg-blue-950 p-6 text-white shadow-2xl shadow-blue-950/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-blue-50">
              <Building2 className="size-4" />
              Partenaires
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Gérez les partenaires
            </h1>

            <p className="mt-3 text-sm leading-7 text-blue-50 sm:text-base">
              Créez et affichez les partenaires officiels liés à votre
              organisation ou à vos établissements.
            </p>
          </div>

          <Link
            href={`/admin/organizations/${organizationId}/partenaires/new`}
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-blue-950 transition hover:bg-blue-50"
          >
            <Plus className="mr-2 size-4" />
            Ajouter un partenaire
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Liste des partenaires
            </h2>
            <p className="text-sm text-slate-600">
              {partenaires.length} partenaire
              {partenaires.length > 1 ? "s" : ""} enregistré
              {partenaires.length > 1 ? "s" : ""}.
            </p>
          </div>

          <form className="w-full sm:w-[340px]">
            <div className="flex h-12 items-center rounded-full border bg-white px-4 shadow-sm transition focus-within:border-blue-950 focus-within:ring-2 focus-within:ring-blue-950/10">
              <Search className="mr-3 size-4 shrink-0 text-slate-400" />
              <Input
                name="q"
                defaultValue={q || ""}
                placeholder="Rechercher un partenaire..."
                className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </form>
        </div>
      </section>

      {partenaires.length === 0 ? (
        <section className="rounded-3xl border border-dashed bg-white p-6 text-sm text-slate-600 shadow-sm">
          Aucun partenaire trouvé.
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {partenaires.map((partenaire) => {
            const logo = partenaire.logo
              ? normalizeImageSrc(partenaire.logo)
              : partenaire.image
                ? normalizeImageSrc(partenaire.image)
                : "";

            return (
              <article
                key={partenaire.id}
                className="overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-950/10"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-cover bg-center bg-blue-50 text-blue-950"
                    style={{
                      backgroundImage: logo ? `url('${logo}')` : undefined,
                    }}
                  >
                    {!logo ? <Building2 className="size-6" /> : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-slate-950">
                      {partenaire.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-600">
                      {partenaire.type || "Partenaire"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {partenaire.isActive ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Actif
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          Inactif
                        </span>
                      )}

                      {partenaire.isFeatured ? (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          Mis en avant
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    {partenaire.ville ||
                      partenaire.pays ||
                      "Lieu non renseigné"}
                  </p>

                  <p className="flex items-center gap-2">
                    <Mail className="size-4" />
                    {partenaire.email || "Email non renseigné"}
                  </p>

                  <p className="text-xs text-slate-500">
                    Branche : {partenaire.branch?.name || "Organisation"}
                  </p>
                </div>

                {partenaire.website ? (
                  <a
                    href={partenaire.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center text-sm font-semibold text-blue-700 hover:underline"
                  >
                    Voir le site
                    <ExternalLink className="ml-2 size-4" />
                  </a>
                ) : null}
                <PartenaireActions id={partenaire.id} organizationId={organizationId} isActive={partenaire.isActive} />
              </article>
            );
          })}
        </section>
      )}

      <Link
        href={`/admin/organizations/${organizationId}`}
        className="inline-flex h-10 w-fit items-center justify-center rounded-full px-4 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
      >
        <ArrowLeft className="mr-2 size-4" />
        Retour organisation
      </Link>
    </div>
  );
}
