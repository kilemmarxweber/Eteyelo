"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { acceptOrganizationInvitationAction } from "@/app/admin/organizations/[organizationId]/members/invitation-actions";
import {
  getInvitationPreviewAction,
  type InvitationPreview,
} from "@/app/accept-invitation/invitation-preview.action";
import { Button } from "@/components/ui/button";
import { buildChangePasswordUrl } from "@/lib/auth/safe-callback-url";
import { INVITATION_MESSAGES } from "@/lib/invitations/messages";
import { authClient } from "@/lib/auth-client";

export function AcceptInvitationClient() {
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("invitationId")?.trim() ?? "";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const acceptPath = invitationId
    ? `/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`
    : "/accept-invitation";
  const changePasswordHref = buildChangePasswordUrl(acceptPath);
  const signInHref = invitationId
    ? `/auth/sign-in?callbackUrl=${encodeURIComponent(acceptPath)}`
    : "/auth/sign-in";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!invitationId) {
        setPreview({
          ok: false,
          message: INVITATION_MESSAGES.notFoundOrExpired,
        });
        setLoadingPreview(false);
        return;
      }

      const result = await getInvitationPreviewAction(invitationId);
      if (!cancelled) {
        setPreview(result);
        setLoadingPreview(false);
        if (result.ok && result.emailMatches && result.mustChangePassword) {
          router.replace(changePasswordHref);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [invitationId, router, changePasswordHref]);

  async function switchAccount() {
    startTransition(async () => {
      await authClient.signOut();
      router.push(signInHref);
      router.refresh();
    });
  }

  function onAccept() {
    if (!invitationId) return;

    startTransition(async () => {
      const res = await acceptOrganizationInvitationAction(invitationId);
      if (!res.ok) {
        if (res.needsPasswordChange) {
          router.push(changePasswordHref);
          return;
        }
        setMessage(res.message);
        toast.error(res.message);
        const refreshed = await getInvitationPreviewAction(invitationId);
        setPreview(refreshed);
        return;
      }

      toast.success(INVITATION_MESSAGES.acceptSuccess);
      await authClient.organization.setActive({
        organizationId: res.organizationId,
      });
      router.push(`/admin/organizations/${res.organizationId}`);
      router.refresh();
    });
  }

  if (loadingPreview) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-sm text-muted-foreground">
        Chargement de l’invitation…
      </div>
    );
  }

  if (!preview || !preview.ok) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col justify-center gap-5 px-4 py-10">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">Invitation</h1>
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {preview && !preview.ok
              ? preview.message
              : INVITATION_MESSAGES.notFoundOrExpired}
          </p>
        </section>
      </div>
    );
  }

  const wrongAccount =
    preview.isAuthenticated && !preview.emailMatches && preview.sessionEmail;
  const needsPasswordChange =
    preview.emailMatches && preview.mustChangePassword;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center gap-5 px-4 py-10">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">
          Accepter l’invitation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous rejoindrez uniquement l’organisation invitée, avec le rôle
          indiqué. Aucune donnée d’une autre organisation ne sera copiée.
        </p>

        <dl className="mt-4 space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Organisation</dt>
            <dd className="font-medium text-right">{preview.organizationName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Email invité</dt>
            <dd className="font-medium text-right">{preview.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Rôle</dt>
            <dd className="font-medium text-right">{preview.roleLabel}</dd>
          </div>
          {preview.sessionEmail ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Compte connecté</dt>
              <dd className="font-medium text-right">{preview.sessionEmail}</dd>
            </div>
          ) : null}
        </dl>

        {wrongAccount ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            Vous êtes connecté avec <strong>{preview.sessionEmail}</strong>,
            alors que l’invitation est destinée à{" "}
            <strong>{preview.email}</strong>. Déconnectez-vous puis
            connectez-vous avec l’email invité.
          </p>
        ) : null}

        {needsPasswordChange ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            {INVITATION_MESSAGES.acceptMustChangePassword}
          </p>
        ) : null}

        {!preview.isAuthenticated ? (
          <p className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-sm">
            Connectez-vous avec <strong>{preview.email}</strong> pour accepter
            cette invitation.
          </p>
        ) : null}

        {message && !wrongAccount && !needsPasswordChange ? (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {message}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {preview.emailMatches && !needsPasswordChange ? (
            <Button type="button" disabled={pending} onClick={onAccept}>
              Accepter
            </Button>
          ) : null}

          {needsPasswordChange ? (
            <Button type="button" asChild>
              <Link href={changePasswordHref}>Changer mon mot de passe</Link>
            </Button>
          ) : null}

          {!preview.isAuthenticated ? (
            <Button type="button" asChild>
              <Link href={signInHref}>Se connecter</Link>
            </Button>
          ) : null}

          {wrongAccount ? (
            <Button type="button" disabled={pending} onClick={switchAccount}>
              Changer de compte
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
