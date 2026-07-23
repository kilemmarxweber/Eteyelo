import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  Building2,
  Handshake,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { isPlatformOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPrimaryRoleLabel } from "@/lib/sidebar-menu";
import { resolveUserDisplayName } from "@/lib/user-display";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const name = resolveUserDisplayName(session?.user);
  const roleLabel = getPrimaryRoleLabel(session);
  const isPlatformOwner = isPlatformOwnerRole(session?.user?.role);

  let partenairesHref = "/admin/organizations";
  if (isPlatformOwner) {
    const firstOrg = await prisma.organization.findFirst({
      orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    if (firstOrg) {
      partenairesHref = `/admin/organizations/${firstOrg.id}/partenaires`;
    }
  }

  const adminCards = [
    {
      title: "Organisations",
      text: "Accédez aux espaces, établissements et équipes.",
      href: "/admin/organizations",
      icon: Building2,
      accent: "from-sky-500/15 via-transparent to-transparent",
      iconClass: "bg-sky-600 text-white",
      show: true,
    },
    {
      title: "Partenaires",
      text: "Créer et gérer les partenaires officiels (owner uniquement).",
      href: partenairesHref,
      icon: Handshake,
      accent: "from-emerald-500/15 via-transparent to-transparent",
      iconClass: "bg-emerald-600 text-white",
      show: isPlatformOwner,
    },
  ].filter((card) => card.show);

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-72 bg-[radial-gradient(ellipse_at_top,_oklch(0.72_0.12_250_/_0.18),_transparent_65%)]"
      />

      <section className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_20px_50px_-28px_oklch(0.45_0.08_250_/_0.45)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(135deg,oklch(0.97_0.02_250)_0%,transparent_42%,oklch(0.96_0.03_180_/_0.55)_100%)]"
        />
        <div
          aria-hidden
          className="absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 left-1/3 size-64 rounded-full bg-sky-400/10 blur-3xl"
        />

        <div className="relative grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-primary p-6 text-primary-foreground sm:p-8 lg:p-10">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_oklch(1_0_0_/_0.16),_transparent_55%)]"
            />
            <div
              aria-hidden
              className="absolute -bottom-10 -left-10 size-40 rounded-full border border-primary-foreground/10"
            />
            <div
              aria-hidden
              className="absolute -right-6 top-10 size-24 rounded-full border border-primary-foreground/10"
            />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                <LayoutDashboard className="size-3.5" />
                Tableau de bord
              </div>

              <h1 className="mt-5 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
                Bienvenue, {name.split(" ")[0]}
              </h1>

              <p className="mt-4 max-w-7xl text-sm leading-7 text-primary-foreground/90 sm:text-base">
                Connecté en tant que{" "}
                <span className="font-semibold text-primary-foreground">
                  {name}
                </span>{" "}
                · {roleLabel}. Retrouvez ici les organisations
                {isPlatformOwner ? " et les partenaires" : ""}.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  className="h-11 rounded-full bg-card px-5 text-foreground shadow-sm hover:bg-muted"
                >
                  <Link href="/admin/organizations">
                    Mes organisations
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                {isPlatformOwner ? (
                  <Button
                    asChild
                    variant="secondary"
                    className="h-11 rounded-full border-0 bg-card/15 px-5 text-white backdrop-blur-sm hover:bg-card/25"
                  >
                    <Link href={partenairesHref}>
                      <Handshake className="mr-2 size-4" />
                      Partenaires
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative flex flex-col justify-center gap-3 p-5 sm:p-6 lg:p-8">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Accès rapide
            </div>

            {adminCards.map(({ icon: Icon, ...card }) => (
              <Link
                key={card.title}
                href={card.href}
                className={cn(
                  "group relative flex min-h-[5.5rem] items-start gap-4 overflow-hidden rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm transition duration-300",
                  "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/10",
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 transition duration-300 group-hover:opacity-100",
                    card.accent,
                  )}
                />
                <span
                  className={cn(
                    "relative flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm transition duration-300 group-hover:scale-105",
                    card.iconClass,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block font-bold text-foreground">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {card.text}
                  </span>
                </span>
                <ArrowRight className="relative mt-1 size-4 shrink-0 text-muted-foreground transition duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
