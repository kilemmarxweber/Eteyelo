"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Archive,
  ArchiveRestore,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  archiveOrganizationMemberAction,
  listOrganizationMembersAction,
  type OrganizationMemberListItem,
} from "@/app/admin/organizations/[organizationId]/members/actions";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResetUsersDialog } from "../branches/(no-layout)/[branchId]/student/components/reset-users-dialog";
import { cn } from "@/lib/utils";

type Props = {
  organizationId: string;
  invitePanel?: ReactNode;
};

export function OrganizationMembersView({
  organizationId,
  invitePanel,
}: Props) {
  const router = useRouter();

  const [members, setMembers] = useState<OrganizationMemberListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);

    try {
      const res = await listOrganizationMembersAction(organizationId);

      if (!res.ok) {
        toast.error(res.message ?? "Erreur chargement.");
        setMembers([]);
        return;
      }

      setMembers(res.members);
    } catch {
      toast.error("Erreur réseau.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return members;

    return members.filter((member) => {
      const role = member.role.split(",")[0]?.trim();

      return (
        member.user.name?.toLowerCase().includes(q) ||
        member.user.email?.toLowerCase().includes(q) ||
        orgRoleLabel(role).toLowerCase().includes(q)
      );
    });
  }, [members, search]);

  async function toggleArchive(member: OrganizationMemberListItem) {
    setArchivingId(member.id);
    try {
      const res = await archiveOrganizationMemberAction({
        organizationId,
        memberId: member.id,
        archive: !member.isArchived,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        member.isArchived ? "Membre réactivé." : "Membre archivé.",
      );
      await loadMembers();
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      {invitePanel}

      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold text-primary-foreground/90">
              <Users className="size-3.5" />
              Membres
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Gérez les membres
            </h1>

            <p className="mt-2 text-sm leading-6 text-primary-foreground/90">
              Créez des comptes, invitez des membres, archivez un accès ou
              attribuez des rôles dans cette organisation.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full bg-card text-foreground hover:bg-muted"
              asChild
            >
              <Link href={`/admin/organizations/${organizationId}/members/new`}>
                <Plus className="mr-1.5 size-3.5" />
                Ajouter un membre
              </Link>
            </Button>

            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void loadMembers()}
              disabled={loading}
              className="rounded-full border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-card hover:text-foreground"
            >
              <RefreshCcw className="mr-1.5 size-3.5" />
              Actualiser
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Liste des membres
            </h2>
            <p className="text-sm text-muted-foreground">
              {members.length} membre{members.length > 1 ? "s" : ""} enregistré
              {members.length > 1 ? "s" : ""}.
            </p>
          </div>

          <div className="w-full sm:w-[300px]">
            <div className="flex h-10 items-center rounded-xl border bg-card px-3 shadow-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
              <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />

              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un membre..."
                className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          Chargement…
        </section>
      ) : filteredMembers.length === 0 ? (
        <section className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Aucun membre trouvé.
        </section>
      ) : (
        <>
          <ResetUsersDialog
            open={resetEmail !== null}
            onOpenChange={(open) => {
              if (!open) setResetEmail(null);
            }}
            email={resetEmail ?? ""}
            organizationId={organizationId}
            showTrigger={false}
          />

          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <ul className="divide-y">
              {filteredMembers.map((member) => {
                const role = member.role.split(",")[0]?.trim();

                return (
                  <li
                    key={member.id}
                    className={cn(
                      "flex flex-col gap-3 p-3.5 transition hover:bg-muted sm:flex-row sm:items-center sm:justify-between",
                      member.isArchived && "opacity-70",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                        {member.user.name?.charAt(0).toUpperCase() || "?"}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {member.user.name}
                        </h3>

                        <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                          <Mail className="size-3.5 shrink-0" />
                          {member.user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      {member.isArchived ? (
                        <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                          Archivé
                        </span>
                      ) : null}
                      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-foreground">
                        {orgRoleLabel(role)}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/admin/organizations/${organizationId}/members/${member.id}/edit`,
                              )
                            }
                          >
                            Modifier
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={() =>
                              setResetEmail(member.user.email ?? "")
                            }
                            disabled={!member.user.email}
                          >
                            Réinitialiser le mot de passe
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            disabled={archivingId === member.id}
                            onSelect={() => void toggleArchive(member)}
                          >
                            {member.isArchived ? (
                              <>
                                <ArchiveRestore className="mr-2 size-3.5" />
                                Réactiver
                              </>
                            ) : (
                              <>
                                <Archive className="mr-2 size-3.5" />
                                Archiver
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
