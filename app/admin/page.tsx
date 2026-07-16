import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  Building2,
  Handshake,
  LayoutDashboard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { isPlatformOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPrimaryRoleLabel } from "@/lib/sidebar-menu";
import { resolveUserDisplayName } from "@/lib/user-display";

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
      text: "Accedez aux espaces, etablissements et equipes.",
      href: "/admin/organizations",
      icon: Building2,
      show: true,
    },
    {
      title: "Partenaires",
      text: "Creer et gerer les partenaires officiels (owner uniquement).",
      href: partenairesHref,
      icon: Handshake,
      show: isPlatformOwner,
    },
  ].filter((card) => card.show);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-primary p-6 text-primary-foreground sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold">
              <LayoutDashboard className="size-4" />
              Tableau de bord
            </div>

            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              Bienvenue dans votre espace admin
            </h2>

            <p className="mt-4 max-w-7xl text-sm leading-7 text-primary-foreground/90 sm:text-base">
              Connecte en tant que {name} · {roleLabel}. Retrouvez ici les
              organisations
              {isPlatformOwner ? " et les partenaires" : ""}.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                asChild
                className="h-11 rounded-full bg-card px-5 text-foreground hover:bg-muted"
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
                  className="h-11 rounded-full border-0 bg-card/15 px-5 text-white hover:bg-card/25"
                >
                  <Link href={partenairesHref}>
                    <Handshake className="mr-2 size-4" />
                    Partenaires
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-6 lg:p-8">
            {adminCards.map(({ icon: Icon, ...card }) => (
              <Link
                key={card.title}
                href={card.href}
                className="group flex min-h-24 items-start gap-4 rounded-2xl border bg-muted p-4 transition hover:border-primary/30 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-foreground">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {card.text}
                  </span>
                </span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
