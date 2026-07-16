"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  removeOrganizationMemberAction,
  updateOrganizationMemberAction,
} from "../../actions";
import { ResetUsersDialog } from "../../../branches/(no-layout)/[branchId]/student/components/reset-users-dialog";

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; email: string; name: string };
};

type Props = { organizationId: string; memberId: string };

export function EditMemberForm({ organizationId, memberId }: Props) {
  const router = useRouter();
  const [member, setMember] = useState<MemberRow | null | undefined>(undefined);
  const [role, setRole] = useState<string>(ALL_ORG_ROLE_SLUGS[2]);
  const [pending, startTransition] = useTransition();
  const [pendingRemove, startRemove] = useTransition();
  const [showResetDialog, setShowResetDialog] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authClient.organization.listMembers({
        query: { organizationId, limit: 200 },
      });
      if (res.error) {
        toast.error(res.error.message ?? "Impossible de charger le membre.");
        setMember(null);
        return;
      }
      const raw = res.data?.members;
      const list = Array.isArray(raw) ? (raw as MemberRow[]) : [];
      const found = list.find((m) => m.id === memberId) ?? null;
      setMember(found);
      if (found) {
        const primary =
          found.role.split(",")[0]?.trim() ?? ALL_ORG_ROLE_SLUGS[2];
        setRole(
          (ALL_ORG_ROLE_SLUGS as readonly string[]).includes(primary)
            ? primary
            : ALL_ORG_ROLE_SLUGS[2],
        );
      }
    } catch {
      toast.error("Erreur réseau.");
      setMember(null);
    }
  }, [organizationId, memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateOrganizationMemberAction({
        organizationId,
        memberId,
        orgRole: role,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Rôle mis à jour.");
      router.refresh();
      await load();
    });
  }

  function onRemove() {
    if (!member) return;
    if (!window.confirm(`Retirer ${member.user.name} de l’organisation ?`))
      return;
    startRemove(async () => {
      const res = await removeOrganizationMemberAction({
        organizationId,
        memberId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Membre retiré.");
      router.push(`/admin/organizations/${organizationId}/members`);
      router.refresh();
    });
  }

  if (member === undefined) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  if (member === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Membre introuvable.</p>
        <Button variant="outline" asChild>
          <Link href={`/admin/organizations/${organizationId}/members`}>
            Retour à la liste
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <p className="font-medium leading-snug break-words">
          {member.user.name}
        </p>
        <p className="break-all text-sm text-muted-foreground">
          {member.user.email}
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={onSave}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-role">Rôle dans l’organisation</Label>
          <Select
            value={role}
            onValueChange={setRole}
            disabled={pending || pendingRemove}
          >
            <SelectTrigger className="h-12 min-h-[48px] text-base sm:h-11 sm:min-h-0 sm:text-sm">
              <SelectValue placeholder="Sélectionner un rôle" />
            </SelectTrigger>

            <SelectContent>
              {[...ALL_ORG_ROLE_SLUGS].map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {orgRoleLabel(slug)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="submit"
            disabled={pending || pendingRemove}
            className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
            disabled={pending || pendingRemove}
            asChild
          >
            <Link href={`/admin/organizations/${organizationId}/members`}>
              Annuler
            </Link>
          </Button>
        </div>
      </form>

      <div className="border-t border-border pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
            disabled={pending || pendingRemove}
            onClick={() => setShowResetDialog(true)}
          >
            Réinitialiser le mot de passe
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
            disabled={pending || pendingRemove}
            onClick={onRemove}
          >
            {pendingRemove ? "…" : "Retirer de l’organisation"}
          </Button>
        </div>
      </div>

      <ResetUsersDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        email={member.user.email}
        organizationId={organizationId}
        showTrigger={false}
      />
    </div>
  );
}
