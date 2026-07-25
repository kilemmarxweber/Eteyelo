"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { HomeMapLocation } from "@/lib/home/home-data";

const HomeBranchesMap = dynamic(
  () =>
    import("@/components/home/home-branches-map").then(
      (mod) => mod.HomeBranchesMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[340px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-500 sm:h-[420px] lg:min-h-[420px]">
        Chargement de la carte…
      </div>
    ),
  },
);

type HomeBranchesMapSectionProps = {
  locations: HomeMapLocation[];
};

export function HomeBranchesMapSection({
  locations,
}: HomeBranchesMapSectionProps) {
  const provinces = useMemo(() => {
    const counts = new Map<string, number>();

    for (const location of locations) {
      const key =
        location.province?.trim() ||
        location.ville?.trim() ||
        location.commune?.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "fr"))
      .map(([name, count]) => ({ name, count }));
  }, [locations]);

  if (locations.length === 0) return null;

  return (
    <section className="bg-slate-50 py-14">
      <div className="mx-auto grid max-w-7xl items-stretch gap-10 px-6 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col justify-center">
          <Badge className="w-fit bg-sky-100 text-sky-700 hover:bg-sky-100">
            Implantation des établissements
          </Badge>

          <h2 className="mt-4 text-3xl font-black leading-tight text-blue-950 sm:text-4xl">
            Nos écoles partenaires sur la carte
          </h2>

          <p className="mt-4 max-w-7xl text-sm leading-7 text-slate-600 sm:text-base">
            Retrouvez les adresses enregistrées des établissements actifs sur
            Klambocore. Cliquez sur un marqueur pour voir le détail et accéder à
            la fiche de l&apos;école.
          </p>

          {provinces.length > 0 ? (
            <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {provinces.map((province) => (
                <li
                  key={province.name}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <span>
                    <span className="font-medium">{province.name}</span>
                    <span className="ml-1 text-xs text-slate-400">
                      ({province.count})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-sm text-slate-500">
              {locations.length} établissement
              {locations.length > 1 ? "s" : ""} localisé
              {locations.length > 1 ? "s" : ""} sur la carte.
            </p>
          )}
        </div>

        <HomeBranchesMap locations={locations} />
      </div>
    </section>
  );
}
