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
import Image from "next/image";
import Link from "next/link";

import { HomeFooter } from "@/components/home-footer";
import { HomeNavbar } from "@/components/home-navbar";
import { Button } from "@/components/ui/button";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { cn } from "@/lib/utils";

const solutions = [
  {
    title: "Créer ou ajouter un établissement",
    href: "/inscription-ecole",
    description:
      "Référencez votre école sur Klambocore et ouvrez un espace de gestion pour vos inscriptions, filières, résultats, événements et contacts.",
    icon: Building2,
    details: [
      "Fiche publique de l'établissement",
      "Gestion des classes, filières et inscriptions",
      "Visibilité auprès des familles",
    ],
    highlight: true,
  },
  {
    title: "Demander un service informatique",
    href: "/services/informatique",
    description:
      "Confiez-nous la mise en place d'outils digitaux, l'automatisation, la maintenance, la sécurité ou l'accompagnement technique de votre structure.",
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
      "Construisez une image claire et professionnelle : identité visuelle, supports de communication, campagnes et présence digitale.",
    icon: Megaphone,
    details: [
      "Identité visuelle et supports imprimables",
      "Communication digitale et réseaux sociaux",
      "Campagnes pour inscriptions et événements",
    ],
  },
  {
    title: "Autres besoins",
    href: "/services/autres",
    description:
      "Parlez-nous d'un projet spécifique : partenariat, accompagnement, formation, intégration ou solution sur mesure.",
    icon: Sparkles,
    details: [
      "Cadrage du besoin avec votre équipe",
      "Proposition adaptée à votre contexte",
      "Suivi jusqu'à la mise en service",
    ],
  },
];

export default function JoinKlambocorePage() {
  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />

      <section className="relative overflow-hidden border-b border-primary/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-full max-w-xl md:max-w-2xl lg:max-w-3xl"
        >
          <Image
            src={KLAMBOCORE_DEFAULT_IMAGE_PATH}
            alt=""
            fill
            priority
            className="object-contain object-right p-6 opacity-20 md:p-10 md:opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/95 to-primary/70" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <LifeBuoy className="size-4" />
            Rejoindre Klambocore
          </div>

          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
            Choisissez la solution adaptée à votre projet
          </h1>

          <p className="mt-4 max-w-4xl text-sm leading-7 text-primary-foreground/90 md:text-base">
            Klambocore Sarl accompagne les établissements et organisations avec
            des solutions scolaires, informatiques, design et marketing pensées
            pour le terrain congolais.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:max-w-4xl">
            <div className="flex items-start gap-3 rounded-2xl bg-primary-foreground/10 p-4 text-sm">
              <BadgeCheck className="mt-0.5 size-5 shrink-0" />
              <span>
                Un parcours clair pour inscrire une école ou lancer un service.
              </span>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-primary-foreground/10 p-4 text-sm">
              <Brush className="mt-0.5 size-5 shrink-0" />
              <span>
                Des solutions construites autour de votre image et de vos
                opérations.
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-12 md:py-14">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Nos parcours
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Quatre façons de collaborer avec nous
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Sélectionnez le parcours qui correspond le mieux à votre besoin.
            Chaque option mène vers un formulaire ou une page dédiée.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {solutions.map(({ icon: Icon, ...solution }) => (
            <Link
              key={solution.title}
              href={solution.href}
              className={cn(
                "group flex min-h-[300px] flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
                solution.highlight &&
                  "border-primary/25 bg-primary/5 ring-1 ring-primary/10",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className={cn(
                    "flex size-12 items-center justify-center rounded-2xl",
                    solution.highlight
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <ArrowUpRight className="size-5 text-muted-foreground transition group-hover:text-primary" />
              </div>

              {solution.highlight ? (
                <span className="mt-4 inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Recommandé
                </span>
              ) : null}

              <div className="mt-4">
                <h3 className="text-lg font-bold leading-tight text-foreground">
                  {solution.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {solution.description}
                </p>
              </div>

              <ul className="mt-auto space-y-2 pt-5 text-sm text-muted-foreground">
                {solution.details.map((detail) => (
                  <li key={detail} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>

        <section className="mt-12 w-full rounded-3xl border border-primary/20 bg-primary/5 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-4xl flex-1">
              <h3 className="text-xl font-bold text-foreground">
                Besoin d&apos;être guidé ?
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Notre équipe peut vous orienter vers la bonne solution, répondre
                à vos questions commerciales ou vous présenter les conditions
                d&apos;utilisation de la plateforme.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-full">
                <Link href="/contact">Nous contacter</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/terms">Voir les CGU</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <HomeFooter />
    </div>
  );
}
