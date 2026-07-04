import {
  ArrowUpRight,
  BadgeCheck,
  Brush,
  Building2,
  Code2,
  LifeBuoy,
  Megaphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { HomeNavbar } from "@/components/home-navbar";

const solutions = [
  {
    title: "Creer ou ajouter un etablissement",
    href: "/inscription-ecole",
    description:
      "Referencez votre ecole sur Klambocore et ouvrez un espace de gestion pour vos inscriptions, filieres, resultats, evenements et contacts.",
    icon: Building2,
    details: [
      "Fiche publique de l'etablissement",
      "Gestion des classes, filieres et inscriptions",
      "Visibilite aupres des familles",
    ],
    highlight: true,
  },
  {
    title: "Demander un service informatique",
    href: "/services/informatique",
    description:
      "Confiez-nous la mise en place d'outils digitaux, l'automatisation, la maintenance, la securite ou l'accompagnement technique de votre structure.",
    icon: Code2,
    details: [
      "Applications web et tableaux de bord",
      "Assistance technique et maintenance",
      "Automatisation des processus internes",
    ],
  },
  {
    title: "Design et marketing",
    href: "/services/design-marketing",
    description:
      "Construisez une image claire et professionnelle: identite visuelle, supports de communication, campagnes et presence digitale.",
    icon: Megaphone,
    details: [
      "Identite visuelle et supports imprimables",
      "Communication digitale et reseaux sociaux",
      "Campagnes pour inscriptions et evenements",
    ],
  },
  {
    title: "Autres besoins",
    href: "/services/autres",
    description:
      "Parlez-nous d'un projet specifique: partenariat, accompagnement, formation, integration ou solution sur mesure.",
    icon: Sparkles,
    details: [
      "Cadrage du besoin avec votre equipe",
      "Proposition adaptee a votre contexte",
      "Suivi jusqu'a la mise en service",
    ],
  },
];

export default function JoinKlambocorePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <HomeNavbar />

      <main className="mx-auto max-w-6xl px-4 py-14">
        <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <div className="flex flex-col justify-between rounded-3xl bg-blue-950 p-7 text-white shadow-2xl shadow-blue-950/10 md:p-9">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
                <LifeBuoy className="size-4" />
                Rejoindre Klambocore
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Choisissez la solution adaptee a votre projet
              </h1>

              <p className="mt-4 max-w-[430px] text-sm leading-7 text-blue-50 md:text-base">
                Klambocore Sarl accompagne les etablissements et organisations
                avec des solutions scolaires, informatiques, design et
                marketing pensees pour le terrain.
              </p>
            </div>

            <div className="mt-10 grid gap-3 text-sm">
              <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                <BadgeCheck className="mt-0.5 size-5 shrink-0" />
                <span>Un parcours clair pour inscrire une ecole ou lancer un service.</span>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                <Brush className="mt-0.5 size-5 shrink-0" />
                <span>Des solutions construites autour de votre image et de vos operations.</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {solutions.map(({ icon: Icon, ...solution }) => (
              <Link
                key={solution.title}
                href={solution.href}
                className={`group flex min-h-[280px] flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-950/25 hover:shadow-xl hover:shadow-blue-950/10 ${
                  solution.highlight ? "border-blue-950/20" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-blue-950 text-white">
                    <Icon className="size-5" />
                  </span>
                  <ArrowUpRight className="size-5 text-slate-400 transition group-hover:text-blue-950" />
                </div>

                <div className="mt-5">
                  <h2 className="text-lg font-bold leading-tight text-slate-950">
                    {solution.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {solution.description}
                  </p>
                </div>

                <ul className="mt-auto space-y-2 pt-5 text-sm text-slate-600">
                  {solution.details.map((detail) => (
                    <li key={detail} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-blue-950" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
