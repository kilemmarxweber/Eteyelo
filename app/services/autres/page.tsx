import { ArrowRight, Handshake, Layers3, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";

import { HomeNavbar } from "@/components/home-navbar";
import { Button } from "@/components/ui/button";

const items = [
  {
    title: "Projet sur mesure",
    text: "Une idee particuliere, un besoin interne ou un service qui ne rentre pas dans une categorie classique.",
    icon: Sparkles,
  },
  {
    title: "Partenariat",
    text: "Collaboration avec Klambocore autour d'une ecole, d'une communaute, d'un service ou d'une initiative.",
    icon: Handshake,
  },
  {
    title: "Accompagnement",
    text: "Conseil, formation, organisation de processus et accompagnement de vos equipes.",
    icon: Layers3,
  },
];

export default function OtherServicesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <HomeNavbar />

      <main className="mx-auto max-w-6xl px-4 py-14">
        <section className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/10 px-3 py-1.5 text-xs font-semibold text-blue-950">
            <MessageCircle className="size-4" />
            Autres besoins
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Parlons de votre besoin et construisons la bonne solution
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
            Si votre demande est specifique, nous pouvons cadrer le besoin,
            proposer une approche simple et avancer avec votre equipe.
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
            Nous contacter
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </main>
    </div>
  );
}
