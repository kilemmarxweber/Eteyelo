"use client";

import { useParams } from "next/navigation";
import {
  ORGANIZATION_ROLE_GROUPS,
  organizationRoleStatements,
} from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";

function RolePermissions({ slug }: { slug: string }) {
  const statements = organizationRoleStatements[slug];
  if (!statements) return null;

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(statements).map(([resource, actions]) => {
        const list = actions as readonly string[] | undefined;
        if (!list?.length) return null;
        return (
          <div key={`${slug}-${resource}`} className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {resource}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {list.map((action) => (
                <Badge
                  key={action}
                  variant="secondary"
                  className="max-w-full shrink-0 wrap-break-word px-2 py-1 text-left font-normal leading-snug"
                >
                  {action}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrganizationRolesPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-5 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-8 md:max-w-4xl md:px-6">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        Grille des roles definis dans l&apos;application (Better Auth · controle
        d&apos;acces). Les presets statiques sont configures dans{" "}
        <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">
          lib/permissions.ts
        </code>
        . Les overrides par organisation utilisent la table{" "}
        <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">
          OrganizationRole
        </code>{" "}
        (Dynamic AC).
      </p>

      <section className="rounded-lg border bg-muted/30 p-4">
        <h2 className="text-sm font-semibold">Dynamic AC (overrides par org)</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Quand{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            dynamicAccessControl.enabled
          </code>{" "}
          est actif, une ligne{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            OrganizationRole
          </code>{" "}
          peut surcharger les permissions d&apos;un role pour une organisation
          donnee. Utiliser uniquement pour des besoins specifiques a un
          etablissement ; les roles par defaut ci-dessous restent la reference.
        </p>
      </section>

      <div className="flex flex-col gap-10">
        {ORGANIZATION_ROLE_GROUPS.map((group) => (
          <section key={group.id} className="flex flex-col gap-6">
            <div className="space-y-1 border-b pb-3">
              <h2 className="text-lg font-semibold">{group.label}</h2>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </div>

            {group.slugs.map((slug) => (
              <article key={slug} className="flex flex-col gap-4 pl-0 md:pl-2">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold leading-snug">
                    {orgRoleLabel(slug)}
                  </h3>
                  <p className="break-all font-mono text-xs leading-relaxed text-muted-foreground">
                    slug · {slug}
                  </p>
                </div>
                <RolePermissions slug={slug} />
              </article>
            ))}
          </section>
        ))}
      </div>

    </div>
  );
}
