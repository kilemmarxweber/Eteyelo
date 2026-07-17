"use client";

import { FileText, List, Mail, Phone, Scale, ScrollText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { HomeFooter } from "@/components/home-footer";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { cn } from "@/lib/utils";
import {
  TERMS_COMPANY,
  TERMS_FOUNDER_EMAIL,
  TERMS_FOUNDER_NAME,
  TERMS_FOUNDER_PHONE,
  TERMS_FOUNDER_PHOTO,
  TERMS_FOUNDER_ROLE,
  TERMS_LAST_UPDATED,
  TERMS_LICENSE_PRICE_USD,
  TERMS_MAINTENANCE_STORAGE_USD,
  TERMS_PLATFORM,
  TERMS_PRODUCT,
  TERMS_SCHOOL_TYPES,
  TERMS_SUBSCRIPTION_MONTHLY_USD,
  TERMS_SUBSCRIPTION_MONTHS,
  type TermsReadingMode,
  termsSections,
} from "@/lib/legal/terms-content";

const readingModes: {
  value: TermsReadingMode;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    value: "resume",
    label: "Résumé",
    description: "L'essentiel en quelques lignes par section.",
    icon: List,
  },
  {
    value: "complet",
    label: "Contrat complet",
    description: "Texte intégral des conditions d'utilisation.",
    icon: Scale,
  },
];

export function TermsPageClient() {
  const [mode, setMode] = useState<TermsReadingMode>("resume");
  const [activeId, setActiveId] = useState(termsSections[0]?.id ?? "");

  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.1, 0.35, 0.6],
      },
    );

    for (const section of termsSections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
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
            <ScrollText className="size-4" />
            Conditions d&apos;utilisation
          </div>

          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
            CGU {TERMS_PLATFORM}
          </h1>

          <p className="mt-4 max-w-4xl text-sm leading-7 text-primary-foreground/90 md:text-base">
            Conditions d&apos;utilisation de {TERMS_PRODUCT}, la solution de
            gestion scolaire numérique éditée par {TERMS_COMPANY}. Choisissez le
            mode de lecture : résumé ou contrat complet.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-primary-foreground/80">
            <span className="rounded-full bg-primary-foreground/10 px-3 py-1.5">
              Dernière mise à jour : {TERMS_LAST_UPDATED}
            </span>
            <Link
              href="/privacy"
              className="rounded-full bg-primary-foreground/10 px-3 py-1.5 transition hover:bg-primary-foreground/20"
            >
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Mode de lecture
              </p>

              <div className="mt-3 grid gap-2">
                {readingModes.map(({ value, label, description, icon: Icon }) => {
                  const selected = mode === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left transition",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-muted/40 text-foreground hover:border-primary/30 hover:bg-card",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="size-4 shrink-0" />
                        {label}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-xs leading-relaxed",
                          selected
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground",
                        )}
                      >
                        {description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Fondateur
              </p>

              <div className="mt-4 flex items-start gap-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                  <Image
                    src={TERMS_FOUNDER_PHOTO}
                    alt={`Portrait de ${TERMS_FOUNDER_NAME}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>

                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {TERMS_FOUNDER_NAME}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {TERMS_FOUNDER_ROLE}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <a
                  href={`mailto:${TERMS_FOUNDER_EMAIL}`}
                  className="flex items-center gap-2 transition hover:text-primary"
                >
                  <Mail className="size-4 shrink-0" />
                  <span className="truncate">{TERMS_FOUNDER_EMAIL}</span>
                </a>
                <a
                  href={`tel:${TERMS_FOUNDER_PHONE}`}
                  className="flex items-center gap-2 transition hover:text-primary"
                >
                  <Phone className="size-4 shrink-0" />
                  <span>{TERMS_FOUNDER_PHONE}</span>
                </a>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Tarifs indicatifs
              </p>

              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/80">
                <li>
                  Par établissement ({TERMS_SCHOOL_TYPES.join(", ").toLowerCase()})
                </li>
                <li>
                  <strong className="text-primary">
                    {TERMS_LICENSE_PRICE_USD.toLocaleString("fr-FR")} $
                  </strong>{" "}
                  — prix fixe négociable
                </li>
                <li>
                  ou{" "}
                  <strong className="text-primary">
                    {TERMS_SUBSCRIPTION_MONTHLY_USD} $/mois
                  </strong>{" "}
                  sur {TERMS_SUBSCRIPTION_MONTHS} mois
                </li>
                <li>
                  Maintenance obligatoire + stockage en ligne{" "}
                  <strong className="text-primary">
                    {TERMS_MAINTENANCE_STORAGE_USD} $
                  </strong>
                </li>
              </ul>

              <button
                type="button"
                onClick={() => scrollToSection("tarification")}
                className="mt-4 text-xs font-semibold text-primary underline underline-offset-4"
              >
                Voir les détails tarifaires
              </button>
            </div>

            <nav
              aria-label="Sommaire des conditions"
              className="mt-4 hidden rounded-2xl border border-border bg-card p-5 shadow-sm lg:block"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Sommaire
              </p>

              <ul className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto pr-1 text-sm">
                {termsSections.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left transition",
                        activeId === section.id
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {section.title}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground lg:hidden">
              {mode === "resume"
                ? "Mode résumé actif — basculez vers « Contrat complet » pour le texte juridique intégral."
                : "Mode contrat complet actif — texte juridique intégral affiché."}
            </div>

            <article className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8 lg:p-10">
              <header className="border-b border-border pb-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  En utilisant les services de {TERMS_COMPANY}, vous acceptez
                  les présentes conditions d&apos;utilisation ainsi que la{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    politique de confidentialité
                  </Link>
                  .
                </p>
              </header>

              <div className="mt-8 space-y-10">
                {termsSections.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-28"
                  >
                    <h2 className="text-lg font-bold tracking-tight text-foreground md:text-xl">
                      {section.title}
                    </h2>

                    {mode === "resume" ? (
                      <p className="mt-3 text-base leading-8 text-foreground/80">
                        {section.summary}
                      </p>
                    ) : (
                      <div className="mt-4 space-y-4 text-base leading-8 text-foreground/80">
                        {section.full.split("\n\n").map((paragraph) => (
                          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </article>
          </div>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
