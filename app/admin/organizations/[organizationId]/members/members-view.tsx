"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  archiveOrganizationMemberAction,
  deleteOrganizationMemberPermanentlyAction,
  getOrganizationMembersReportContextAction,
  listOrganizationMembersAction,
  type OrganizationMemberListItem,
} from "@/app/admin/organizations/[organizationId]/members/actions";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  comparePersonNames,
  formatPersonFullName,
} from "@/lib/person-full-name";
import { ORG_ROLE } from "@/lib/permissions";
import { memberHasImplicitAllBranchAccess } from "@/lib/auth/role-labels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResetUsersDialog } from "../branches/(no-layout)/[branchId]/student/components/reset-users-dialog";
import { exportMembersReportPdf } from "./export-members-pdf";
import { cn, normalizeImageSrc } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";

const PAGE_SIZE = 8;

type Props = {
  organizationId: string;
  invitePanel?: ReactNode;
};

function primaryRole(role: string): string {
  return role.split(",")[0]?.trim() || "";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case ORG_ROLE.OWNER:
      return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case ORG_ROLE.GESTIONNAIRE:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    case ORG_ROLE.PREFET:
    case ORG_ROLE.DIRECTEUR:
    case ORG_ROLE.DIRECTEUR_ETUDES:
      return "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100";
    case ORG_ROLE.TEACHER:
      return "border-violet-500/30 bg-violet-500/10 text-violet-900 dark:text-violet-100";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function visiblePages(page: number, pageCount: number): number[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  return [...set].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
}

export function OrganizationMembersView({
  organizationId,
  invitePanel,
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const canDeletePermanently = isOrganizationOwnerSession(session);
  const [members, setMembers] = useState<OrganizationMemberListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [page, setPage] = useState(1);
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingMember, setDeletingMember] =
    useState<OrganizationMemberListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const roleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) {
      const slug = primaryRole(member.role);
      if (!slug || map.has(slug)) continue;
      map.set(slug, orgRoleLabel(slug));
    }
    return [...map.entries()]
      .map(([slug, label]) => ({ slug, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [members]);

  const selectedRoleLabel =
    roleFilter === "all"
      ? null
      : (roleOptions.find((role) => role.slug === roleFilter)?.label ?? null);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = members.filter((member) => {
      const role = primaryRole(member.role);
      if (roleFilter !== "all" && role !== roleFilter) return false;
      if (!q) return true;
      const fullName = formatPersonFullName(member.user);
      const branchNames = member.branches.map((b) => b.name.toLowerCase());
      const matchesAllBranchesLabel =
        memberHasImplicitAllBranchAccess(role) &&
        q.length >= 3 &&
        "tous les établissements".includes(q);
      return (
        fullName.toLowerCase().includes(q) ||
        member.user.email?.toLowerCase().includes(q) ||
        orgRoleLabel(role).toLowerCase().includes(q) ||
        branchNames.some((name) => name.includes(q)) ||
        matchesAllBranchesLabel
      );
    });

    return result.sort((a, b) => {
      if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
      const byRole = orgRoleLabel(primaryRole(a.role)).localeCompare(
        orgRoleLabel(primaryRole(b.role)),
        "fr",
        { sensitivity: "base" },
      );
      if (byRole !== 0) return byRole;
      return comparePersonNames(a.user, b.user);
    });
  }, [members, search, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [filteredMembers, safePage]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  useEffect(() => {
    if (loading || roleFilter === "all") return;
    if (!roleOptions.some((role) => role.slug === roleFilter)) {
      setRoleFilter("all");
    }
  }, [loading, roleFilter, roleOptions]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function exportPdf() {
    if (filteredMembers.length === 0 || exportingPdf) return;
    setExportingPdf(true);
    try {
      const res = await getOrganizationMembersReportContextAction(
        organizationId,
      );
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      await exportMembersReportPdf(filteredMembers, res.context, {
        roleLabel: selectedRoleLabel,
      });
      toast.success("PDF généré.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Impossible de générer le PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  }

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
      toast.success(member.isArchived ? "Membre réactivé." : "Membre archivé.");
      await loadMembers();
    } finally {
      setArchivingId(null);
    }
  }

  async function confirmPermanentDelete() {
    if (!deletingMember) return;
    setDeleting(true);
    try {
      const res = await deleteOrganizationMemberPermanentlyAction({
        organizationId,
        memberId: deletingMember.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Membre supprimé définitivement.");
      setDeletingMember(null);
      await loadMembers();
    } finally {
      setDeleting(false);
    }
  }

  const listHref = `/admin/organizations/${organizationId}/members`;
  const pages = visiblePages(safePage, pageCount);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}`}
        label="Retour organisation"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Équipe
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Membres</h1>
          <p className="max-w-7xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Gérez les comptes de l’organisation, leurs rôles et l’accès aux
            établissements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => void loadMembers()}
            disabled={loading}
          >
            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
            Actualiser
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => void exportPdf()}
            disabled={loading || exportingPdf || filteredMembers.length === 0}
          >
            <FileDown className="size-4" />
            {exportingPdf ? "PDF…" : "PDF"}
          </Button>
          <Button className="h-11" asChild>
            <Link href={`${listHref}/new`}>
              <Plus className="size-4" />
              Ajouter un membre
            </Link>
          </Button>
        </div>
      </div>

      {invitePanel}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 w-full flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 w-full flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email, rôle ou établissement…"
              className="h-11 rounded-xl pl-10"
            />
          </div>
          <select
            aria-label="Trier par rôle"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm sm:w-56"
          >
            <option value="all">Tous les rôles</option>
            {roleOptions.map((role) => (
              <option key={role.slug} value={role.slug}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground sm:text-sm sm:shrink-0">
          {loading
            ? "Chargement…"
            : `${filteredMembers.length} membre${filteredMembers.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[4.5rem] animate-pulse rounded-2xl border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <Users className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">
            {members.length === 0
              ? "Aucun membre pour le moment."
              : "Aucun résultat pour cette recherche ou ce rôle."}
          </p>
          {members.length === 0 ? (
            <Button className="mt-4 h-11" asChild>
              <Link href={`${listHref}/new`}>
                <Plus className="size-4" />
                Ajouter le premier membre
              </Link>
            </Button>
          ) : null}
        </div>
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

          <Dialog
            open={deletingMember !== null}
            onOpenChange={(open) => {
              if (!open && !deleting) setDeletingMember(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Supprimer définitivement le membre ?</DialogTitle>
                <DialogDescription>
                  {deletingMember
                    ? `Cette action est irréversible : ${formatPersonFullName(deletingMember.user) || deletingMember.user.email} sera retiré de l’organisation, avec tous les profils liés (élève, enseignant, parent, personnel) et leurs données (inscriptions, paiements, présences, affectations…). S’il n’a plus d’autre organisation, son compte sera aussi effacé.`
                    : "Cette action est irréversible."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:space-x-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleting}
                  onClick={() => setDeletingMember(null)}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => void confirmPermanentDelete()}
                >
                  {deleting ? "Suppression…" : "Supprimer définitivement"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ul
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            role="list"
          >
            {pageItems.map((member, index) => {
              const role = primaryRole(member.role);
              const fullName = formatPersonFullName(member.user);
              const photoSrc = member.user.image
                ? normalizeImageSrc(member.user.image)
                : null;
              const isOwner =
                role === ORG_ROLE.OWNER ||
                memberHasImplicitAllBranchAccess(role);
              const hasNoBranch = member.branches.length === 0;
              const shouldGrayOut = hasNoBranch && !isOwner;
              const isEmailArchived =
                !!member.user.archivedEmail ||
                !!(
                  member.user.email &&
                  member.user.email.startsWith("archived.")
                );
              const displayEmail =
                member.user.archivedEmail ||
                (member.user.email?.startsWith("archived.")
                  ? member.user.email.replace(/^archived\./, "")
                  : member.user.email);
              return (
                <li
                  key={member.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5 transition-colors",
                    index > 0 && "border-t border-border",
                    member.isArchived && "opacity-70",
                    shouldGrayOut &&
                      "bg-muted/40 text-muted-foreground opacity-60 grayscale",
                  )}
                >
                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {photoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoSrc}
                        alt=""
                        className="size-full rounded-full object-cover"
                      />
                    ) : (
                      initials(fullName || displayEmail || "?")
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium leading-snug">
                        {fullName || "Sans nom"}
                      </p>
                      {member.isArchived ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                        >
                          Archivé
                        </Badge>
                      ) : null}
                      {isEmailArchived ? (
                        <Badge
                          variant="outline"
                          className="border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300 text-xs"
                        >
                          E-mail archivé
                        </Badge>
                      ) : null}
                      <Badge
                        variant="outline"
                        className={cn("font-medium", roleBadgeClass(role))}
                      >
                        {orgRoleLabel(role)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {displayEmail}
                      {isEmailArchived && member.user.email ? (
                        <span className="ml-1.5 text-xs opacity-75 font-mono">
                          ({member.user.email})
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {memberHasImplicitAllBranchAccess(role) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="size-3.5" />
                          Tous les établissements
                        </span>
                      ) : member.branches.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="size-3.5" />
                          Aucun établissement
                        </span>
                      ) : (
                        member.branches.map((b) => (
                          <Badge
                            key={b.id}
                            variant="secondary"
                            className="max-w-full gap-1 font-normal"
                          >
                            <Building2 className="size-3 shrink-0 opacity-70" />
                            <span className="truncate">{b.name}</span>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <MoreHorizontal className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52">
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() =>
                          router.push(`${listHref}/${member.id}/edit`)
                        }
                      >
                        <Pencil className="size-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        disabled={!member.user.email}
                        onSelect={() =>
                          setResetEmail(member.user.email ?? "")
                        }
                      >
                        <KeyRound className="size-4" />
                        Réinitialiser le mot de passe
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2"
                        disabled={archivingId === member.id}
                        onSelect={() => void toggleArchive(member)}
                      >
                        {member.isArchived ? (
                          <>
                            <ArchiveRestore className="size-4" />
                            Réactiver
                          </>
                        ) : (
                          <>
                            <Archive className="size-4" />
                            Archiver
                          </>
                        )}
                      </DropdownMenuItem>
                      {canDeletePermanently ? (
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                          disabled={deleting}
                          onSelect={() => setDeletingMember(member)}
                        >
                          <Trash2 className="size-4" />
                          Supprimer définitivement
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-3 py-2.5 shadow-sm">
            <p className="text-xs tabular-nums text-muted-foreground">
              {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredMembers.length)} sur{" "}
              {filteredMembers.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-full"
                aria-label="Page précédente"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-1 px-1">
                {pages.map((n, i) => {
                  const prev = pages[i - 1];
                  return (
                    <span key={n} className="contents">
                      {prev != null && n - prev > 1 ? (
                        <span className="px-1 text-xs text-muted-foreground">
                          …
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPage(n)}
                        aria-current={n === safePage ? "page" : undefined}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition",
                          n === safePage
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {n}
                      </button>
                    </span>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-full"
                aria-label="Page suivante"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
