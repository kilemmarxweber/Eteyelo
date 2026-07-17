import { Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import ContactForm from "./contact-form";
import { HomeFooter } from "@/components/home-footer";
import { HomeNavbar } from "@/components/home-navbar";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";

type ContactPageProps = {
  searchParams: Promise<{ user?: string }>;
};

const contactEmail =
  process.env.SMTP_USER?.trim() || "contact@klambocore.com";
const contactPhone = "+243844952966";
const contactAddress =
  "Avenue Route Bypass 425, Mont-Ngafula, Kinshasa, RDC";

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { user } = await searchParams;

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

        <div className="relative mx-auto max-w-7xl px-4 py-8 md:py-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90">
            <MessageCircle className="size-4" />
            Contact Klambocore Sarl
          </div>

          <p className="mt-3 max-w-4xl text-sm leading-7 text-primary-foreground/90 md:text-base">
            Écrivez-nous pour une inscription, un partenariat, une demande de
            support, un devis ou une question sur les établissements référencés
            sur Klambocore.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-12 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Coordonnées
              </p>

              <ul className="mt-5 space-y-3 text-sm">
                <li>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <Mail className="mt-0.5 size-5 shrink-0 text-primary" />
                    <span className="break-all text-foreground">{contactEmail}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`tel:${contactPhone}`}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <Phone className="mt-0.5 size-5 shrink-0 text-primary" />
                    <span className="text-foreground">{contactPhone}</span>
                  </a>
                </li>
                <li>
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
                    <span className="text-foreground">{contactAddress}</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 md:p-7">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">
                    Délai de réponse
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Notre équipe revient vers vous dès que possible, en
                    général sous 24 à 48 heures ouvrables.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Liens utiles
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ["Rejoindre Klambocore", "/rejoindre-klambocore"],
                  ["Conditions d'utilisation", "/terms"],
                  ["Support", "/support"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          <section className="w-full max-w-7xl">
            <div className="mb-5 max-w-7xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Formulaire
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Envoyez-nous votre message
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Décrivez votre besoin avec le plus de détails possible. Nous
                vous orienterons vers la bonne solution.
              </p>
            </div>

            <ContactForm recipientId={user} subject="Demande de contact" />
          </section>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
