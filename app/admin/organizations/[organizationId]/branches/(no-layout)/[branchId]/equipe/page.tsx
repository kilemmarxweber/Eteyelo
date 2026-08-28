import Link from "next/link";
import { IconArrowRight, IconShieldLock, IconUsers } from "@tabler/icons-react";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { getCachedSession } from "@/lib/auth/get-session-cached";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";

export default async function BranchTeamPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  const session = await getCachedSession();
  const canSeeRoles = isOrganizationOwnerSession(session);
  const teamHref = `/admin/organizations/${organizationId}/branches/${branchId}/equipe`;
  const sections = [
    {
      title: "Utilisateurs",
      description:
        "Consultez les membres rattachés à cet établissement et leurs rôles.",
      href: `${teamHref}/utilisateurs`,
      icon: IconUsers,
    },
    ...(canSeeRoles
      ? [
          {
            title: "Rôles",
            description:
              "Configurez les rôles et privilèges partagés dans toute l’organisation.",
            href: `${teamHref}/roles`,
            icon: IconShieldLock,
          },
        ]
      : []),
  ];

  return (
    <BranchPageShell
      title="Équipe"
      description="Gérez les utilisateurs et les droits d’accès de l’établissement."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.title}
              href={section.href}
              className="group flex min-h-36 flex-col rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/30 sm:min-h-40 sm:p-5"
            >
              <div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary sm:mb-5 sm:size-10">
                <Icon size={20} className="sm:size-[22px]" />
              </div>
              <h2 className="text-base font-semibold sm:text-lg">
                {section.title}
              </h2>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">
                {section.description}
              </p>
              <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary sm:pt-5">
                Ouvrir
                <IconArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          );
        })}
      </div>
    </BranchPageShell>
  );
}
