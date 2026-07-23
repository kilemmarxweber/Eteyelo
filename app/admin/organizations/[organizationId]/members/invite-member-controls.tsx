"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useState } from "react";
import { MailPlus } from "lucide-react";
import { toast } from "sonner";
import {
  inviteOrganizationMemberAction,
  cancelOrganizationInvitationAction,
  type PendingInvitationRow,
} from "@/app/admin/organizations/[organizationId]/members/invitation-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { INVITATION_MESSAGES } from "@/lib/invitations/messages";

type Props = {
  organizationId: string;
  invitableRoles: string[];
  initialInvitations: PendingInvitationRow[];
};

export function InviteMemberControls({
  organizationId,
  invitableRoles,
  initialInvitations,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(invitableRoles[0] ?? "gestionnaire");
  const [invitations, setInvitations] = useState(initialInvitations);
  const [pending, startTransition] = useTransition();

  function refreshLocalAfterInvite(invitationId: string) {
    setInvitations((prev) => {
      const without = prev.filter(
        (item) => item.email.toLowerCase() !== email.trim().toLowerCase(),
      );
      return [
        {
          id: invitationId,
          email: email.trim().toLowerCase(),
          role,
          status: "pending",
          expiresAt: new Date(),
          createdAt: new Date(),
        },
        ...without,
      ];
    });
  }

  function onInvite(resend = false) {
    startTransition(async () => {
      const res = await inviteOrganizationMemberAction({
        organizationId,
        email,
        role,
        resend,
      });
      if (!res.ok) {
        if (res.message === INVITATION_MESSAGES.alreadyInvited) {
          const confirmResend = window.confirm(
            "Une invitation est déjà en attente. Renvoyer l’email ?",
          );
          if (confirmResend) {
            onInvite(true);
          }
          return;
        }
        toast.error(res.message);
        return;
      }
      toast.success(INVITATION_MESSAGES.inviteSent);
      refreshLocalAfterInvite(res.invitationId);
      setEmail("");
      setOpen(false);
    });
  }

  function onCancel(invitationId: string) {
    startTransition(async () => {
      const res = await cancelOrganizationInvitationAction({
        organizationId,
        invitationId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setInvitations((prev) => prev.filter((item) => item.id !== invitationId));
      toast.success(INVITATION_MESSAGES.inviteCancelled);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full">
              <MailPlus className="mr-1.5 size-3.5" />
              Inviter un membre
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter un membre</DialogTitle>
              <DialogDescription>
                Précisez l’email et le rôle dans cette organisation. Aucune
                donnée d’une autre org ne sera importée.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <label className="block space-y-2 text-sm font-medium">
                Email
                <Input
                  type="email"
                  value={email}
                  disabled={pending}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="membre@example.com"
                />
              </label>

              <label className="block space-y-2 text-sm font-medium">
                Rôle
                <select
                  value={role}
                  disabled={pending}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {invitableRoles.map((slug) => (
                    <option key={slug} value={slug}>
                      {orgRoleLabel(slug)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                disabled={pending || !email.trim() || !role}
                onClick={() => onInvite(false)}
              >
                Envoyer l’invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {invitations.length > 0 ? (
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">Invitations en attente</h2>
          <ul className="mt-3 divide-y">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {invitation.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {orgRoleLabel(invitation.role ?? "")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onCancel(invitation.id)}
                >
                  Annuler
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
