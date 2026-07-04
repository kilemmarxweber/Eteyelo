import { ArrowRight, Code2, Database, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";

import { HomeNavbar } from "@/components/home-navbar";
import { Button } from "@/components/ui/button";

const items = [
  {
    title: "Applications et plateformes",
    text: "Creation d'applications web, espaces de gestion, tableaux de bord et outils internes.",
    icon: Code2,
  },
  {
    title: "Donnees et automatisation",
    text: "Organisation des donnees, formulaires, exports, workflows et automatisation des taches repetitives.",
    icon: Database,
  },
  {
    title: "Maintenance et securite",
    text: "Suivi technique, corrections, sauvegardes, performance et accompagnement de vos equipes.",
    icon: ShieldCheck,
  },
];

export default function ITServicePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <HomeNavbar />

      <main className="mx-auto max-w-6xl px-4 py-14">
        <section className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/10 px-3 py-1.5 text-xs font-semibold text-blue-950">
            <Wrench className="size-4" />
            Service informatique
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Des outils fiables pour mieux piloter votre organisation
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
            Nous concevons, integrons et maintenons des solutions numeriques
            adaptees aux etablissements, entreprises et projets locaux.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map(({ icon: Icon, ...item }) => (
            <article key={item.title} className="rounded-2xl border bg-white p-5 shadow-sm">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-950 text-white">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-5 font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.text}</p>
            </article>
          ))}
        </section>

        <Button asChild className="mt-10 rounded-full bg-blue-950 px-6 text-white hover:bg-blue-900">
          <Link href="/contact">
            Demander ce service
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </main>
    </div>
  );
}
