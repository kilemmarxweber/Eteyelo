import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Building2,
  LifeBuoy,
  Mail,
  Shield,
  UserRoundX,
} from "lucide-react";

import { SignOutButton } from "@/app/admin/no-organization/sign-out-button";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { resolveUserOrganizationFallbackPath } from "@/lib/auth/resolve-user-organization-path";
import {
  APP_ROLE,
  isPlatformOwnerRole,
  isPlatformSupportAppRole,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPrimaryRoleLabel } from "@/lib/sidebar-menu";
import { resolveUserDisplayName } from "@/lib/user-display";

export const dynamic = "force-dynamic";

async function getPlatformOwnerContact() {
  return prisma.user.findFirst({
    where: { role: APP_ROLE.OWNER },
    select: { email: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

export default async function NoOrganizationPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const appRole = session.user.role;
  if (isPlatformOwnerRole(appRole)) {
    redirect("/admin");
  }
  if (isPlatformSupportAppRole(appRole)) {
    redirect("/admin/platform-support");
  }

  const membership = await getUserOrganizationMembership(session.user.id);
  if (membership) {
    redirect(
      await resolveUserOrganizationFallbackPath(session.user.id, appRole),
    );
  }

  const owner = await getPlatformOwnerContact();
  const ownerEmail = owner?.email?.trim() || null;
  const ownerLabel = owner?.name?.trim() || "Super administrateur";
  const displayName = resolveUserDisplayName(session.user);
  const roleLabel = getPrimaryRoleLabel(session);
  const mailSubject = encodeURIComponent(
    "Demande d'accès à une organisation Eteyelo",
  );
  const mailtoHref = ownerEmail
    ? `mailto:${ownerEmail}?subject=${mailSubject}`
    : null;

  const infoCards = [
    {
      title: "Compte utilisateur",
      text: "Votre compte a le rôle utilisateur. Il ne peut pas créer d’organisation seul.",
      icon: UserRoundX,
    },
    {
      title: "Organisation requise",
      text: "L’accès aux établissements et aux outils se fait uniquement via une organisation.",
      icon: Building2,
    },
    {
      title: "Rôle du super admin",
      text: "Seul le super administrateur peut créer une organisation et vous y inviter.",
      icon: Shield,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-blue-950 p-6 text-white sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-card/15 px-3 py-1.5 text-xs font-semibold">
              <Building2 className="size-4" />
              Accès organisation
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              Aucune organisation assignée
            </h1>

            <p className="mt-4 max-w-7xl text-sm leading-7 text-blue-50 sm:text-base">
              Connecté en tant que{" "}
              <span className="font-semibold text-white">
                {displayName} · {roleLabel}
              </span>
              . Votre compte n’est rattaché à aucune organisation pour le
              moment.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {mailtoHref ? (
                <Button
                  asChild
                  className="h-11 rounded-full bg-card px-5 text-foreground hover:bg-blue-50"
                >
                  <a href={mailtoHref}>
                    <Mail className="mr-2 size-4" />
                    Écrire au super admin
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  className="h-11 rounded-full bg-card px-5 text-foreground hover:bg-blue-50"
                >
                  <Link href="/contact">
                    <LifeBuoy className="mr-2 size-4" />
                    Contacter le support
                  </Link>
                </Button>
              )}
              <SignOutButton className="border-white/40 bg-transparent text-white hover:bg-card/10 hover:text-white" />
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-1 lg:gap-4 lg:p-8">
            {infoCards.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex min-h-24 items-start gap-4 rounded-2xl border bg-muted p-4 sm:p-5"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Shield className="size-5" />
            </span>
            <h2 className="text-base font-bold text-foreground sm:text-lg">
              Contacter le super admin
            </h2>
          </div>

          {ownerEmail ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Demandez l’accès à{" "}
              <span className="font-semibold text-foreground">{ownerLabel}</span>
              {" via "}
              <a
                href={mailtoHref!}
                className="break-all font-medium text-foreground underline-offset-4 hover:underline"
              >
                {ownerEmail}
              </a>
              .
            </p>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Aucun super administrateur n’est encore configuré. Contactez le
              support pour activer la plateforme.
            </p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <LifeBuoy className="size-5" />
            </span>
            <h2 className="text-base font-bold text-foreground sm:text-lg">
              Vous êtes le super admin ?
            </h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Déconnectez-vous, puis connectez-vous avec le compte owner de la
            plateforme pour créer une organisation et inviter des membres.
          </p>
          <div className="mt-4">
            <SignOutButton label="Se déconnecter" />
          </div>
        </div>
      </section>
    </div>
  );
}
