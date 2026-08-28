import Link from "next/link";
import { IconExternalLink, IconUsers } from "@tabler/icons-react";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { listBranchTeamMembersAction } from "../equipe.action";

const BRANCH_ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Direction",
  CAISSIER: "Caissier",
  ADMIN: "Administration",
  TEACHER: "Enseignant",
  PARENT: "Parent",
  STUDENT: "Élève",
};

export const dynamic = "force-dynamic";

export default async function BranchTeamUsersPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  const [members, error] = await listBranchTeamMembersAction({
    organizationId,
    branchId,
  });
  const organizationMembersHref = `/admin/organizations/${organizationId}/members`;
  const teamHref = `/admin/organizations/${organizationId}/branches/${branchId}/equipe`;

  return (
    <BranchPageShell
      title="Utilisateurs"
      description="Membres rattachés à cet établissement et rôles actuellement attribués."
      backHref={teamHref}
      backLabel="Retour à l’équipe"
      actions={
        <Button asChild>
          <Link href={organizationMembersHref}>
            Gérer les membres
            <IconExternalLink size={16} className="ml-2" />
          </Link>
        </Button>
      }
    >
      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Impossible de charger les membres de cet établissement.
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <IconUsers size={18} className="text-muted-foreground" />
              <h2 className="font-semibold">Membres de l’établissement</h2>
            </div>
            <Badge variant="secondary">
              {members.length} membre{members.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {members.length === 0 ? (
            <div className="space-y-3 px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun membre n’est encore rattaché à cet établissement.
              </p>
              <Button asChild variant="outline">
                <Link href={organizationMembersHref}>
                  Ajouter ou inviter un membre
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-5">Nom</th>
                    <th className="px-4 py-3 font-medium">E-mail</th>
                    <th className="px-4 py-3 font-medium">
                      Rôle organisation
                    </th>
                    <th className="px-4 py-3 font-medium sm:pr-5">
                      Rôle établissement
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-4 py-3 font-medium sm:px-5">
                        {member.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {member.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {orgRoleLabel(member.organizationRole)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 sm:pr-5">
                        {BRANCH_ROLE_LABELS[member.branchRole] ??
                          member.branchRole}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        La création de comptes et les invitations restent centralisées dans les{" "}
        <Link
          href={organizationMembersHref}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          membres de l’organisation
        </Link>
        .
      </p>
    </BranchPageShell>
  );
}
