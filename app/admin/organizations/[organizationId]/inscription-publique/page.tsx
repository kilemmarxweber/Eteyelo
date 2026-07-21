import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

/**
 * Hub org : l'edition se fait dans Parametres de chaque ecole
 * (.../branches/[branchId]/settings/inscription-publique).
 */
export default async function InscriptionPubliqueOrgHubPage({
  params,
}: PageProps) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);

  const branches = await prisma.branch.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, ville: true },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour a l'organisation"
      />

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Communication publique</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Les conditions, frais et programme de rentree se configurent
              dans les <strong>Parametres</strong> de chaque ecole (menu
              lateral → Communication publique).
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-2">
          {branches.length === 0 ? (
            <li className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Aucun etablissement actif.
            </li>
          ) : (
            branches.map((branch) => (
              <li key={branch.id}>
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link
                    href={`/admin/organizations/${organizationId}/branches/${branch.id}/settings/inscription-publique`}
                  >
                    <span>
                      {branch.name}
                      {branch.ville ? ` · ${branch.ville}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ouvrir les parametres
                    </span>
                  </Link>
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
