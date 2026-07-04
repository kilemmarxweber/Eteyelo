"use client";

import Link from "next/link";
import { ArrowRight, Building2, LayoutDashboard, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

const adminCards = [
  {
    title: "Organisations",
    text: "Accedez aux espaces, etablissements, membres et roles.",
    href: "/admin/organizations",
    icon: Building2,
  },
  {
    title: "Membres",
    text: "Invitez, organisez et controlez les acces de vos equipes.",
    href: "/admin/organizations",
    icon: Users,
  },
  {
    title: "Permissions",
    text: "Gardez une administration claire avec des droits bien separes.",
    href: "/admin/organizations",
    icon: ShieldCheck,
  },
];

export default function AdminPage() {
  const { data: session, isPending } = useSession();
  const name = session?.user?.name ?? "...";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-blue-950 p-6 text-white sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
              <LayoutDashboard className="size-4" />
              Tableau de bord
            </div>

            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              Bienvenue dans votre espace admin
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-7 text-blue-50 sm:text-base">
              {isPending
                ? "Chargement de votre session..."
                : `Connecte en tant que ${name}.`}{" "}
              Retrouvez ici les organisations, leurs etablissements et les
              parametres essentiels.
            </p>

            <Button
              asChild
              className="mt-8 h-11 rounded-full bg-white px-5 text-blue-950 hover:bg-blue-50"
            >
              <Link href="/admin/organizations">
                Mes organisations
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 p-5 sm:p-6 lg:p-8">
            {adminCards.map(({ icon: Icon, ...card }) => (
              <Link
                key={card.title}
                href={card.href}
                className="group flex min-h-24 items-start gap-4 rounded-2xl border bg-slate-50 p-4 transition hover:border-blue-950/25 hover:bg-white hover:shadow-lg hover:shadow-blue-950/10"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-950 text-white">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-slate-950">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">
                    {card.text}
                  </span>
                </span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-950" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
