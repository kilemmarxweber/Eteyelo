"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useState } from "react";
import { toast } from "sonner";
import { updateOrganizationInvitationsConfigAction } from "@/app/admin/organizations/[organizationId]/members/invitation-actions";
import { Button } from "@/components/ui/button";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import type { OrganizationInvitationsConfig } from "@/lib/invitations/config";
import { INVITATION_MESSAGES } from "@/lib/invitations/messages";

type Props = {
  organizationId: string;
  initialConfig: OrganizationInvitationsConfig;
};

export function InvitationsConfigForm({
  organizationId,
  initialConfig,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [config, setConfig] = useState(initialConfig);

  function toggleRole(role: string) {
    setConfig((prev) => {
      const has = prev.invitableRoles.includes(role);
      const invitableRoles = has
        ? prev.invitableRoles.filter((r) => r !== role)
        : [...prev.invitableRoles, role];
      return { ...prev, invitableRoles };
    });
  }

  function onSave() {
    startTransition(async () => {
      const res = await updateOrganizationInvitationsConfigAction({
        organizationId,
        config,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setConfig(res.config);
      toast.success(INVITATION_MESSAGES.configSaved);
    });
  }

  return (
    <div className="space-y-6">
      <label className="flex items-start gap-3 rounded-2xl border bg-card p-4">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={config.enabled}
          disabled={pending}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, enabled: e.target.checked }))
          }
        />
        <span>
          <span className="block text-sm font-semibold">Activer les invitations</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Affiche le bouton Inviter et autorise l’envoi d’emails d’invitation
            pour cette organisation.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-2xl border bg-card p-4">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={config.allowMultiOrg}
          disabled={pending}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, allowMultiOrg: e.target.checked }))
          }
        />
        <span>
          <span className="block text-sm font-semibold">
            Autoriser le multi-organisation
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Un utilisateur déjà membre d’une autre org peut accepter
            l’invitation. Les données restent cloisonnées par organisation.
          </span>
        </span>
      </label>

      <label className="block space-y-2 text-sm font-medium">
        Durée de validité (jours)
        <input
          type="number"
          min={1}
          max={30}
          disabled={pending}
          value={config.expiresInDays}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              expiresInDays: Number(e.target.value) || 7,
            }))
          }
          className="h-11 w-full rounded-2xl border bg-card px-3 text-sm outline-none"
        />
      </label>

      <div className="space-y-3">
        <p className="text-sm font-medium">Rôles invitables</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_ORG_ROLE_SLUGS.map((role) => (
            <label
              key={role}
              className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={config.invitableRoles.includes(role)}
                disabled={pending}
                onChange={() => toggleRole(role)}
              />
              {orgRoleLabel(role)}
            </label>
          ))}
        </div>
      </div>

      <Button type="button" disabled={pending} onClick={onSave}>
        Enregistrer
      </Button>
    </div>
  );
}
