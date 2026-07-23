"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { INVITATION_MESSAGES } from "@/lib/invitations/messages";
import { prisma } from "@/lib/prisma";

export type InvitationPreview =
  | {
      ok: true;
      invitationId: string;
      email: string;
      roleLabel: string;
      organizationName: string;
      organizationId: string;
      sessionEmail: string | null;
      emailMatches: boolean;
      isAuthenticated: boolean;
      mustChangePassword: boolean;
    }
  | { ok: false; message: string };

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export async function getInvitationPreviewAction(
  invitationId: string,
): Promise<InvitationPreview> {
  const id = invitationId.trim();
  if (!id) {
    return { ok: false, message: INVITATION_MESSAGES.notFoundOrExpired };
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  });

  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt < new Date()
  ) {
    return { ok: false, message: INVITATION_MESSAGES.notFoundOrExpired };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const sessionEmail = normalizeEmail(session?.user?.email);
  const invitedEmail = normalizeEmail(invitation.email);
  const emailMatches = Boolean(sessionEmail) && sessionEmail === invitedEmail;

  let mustChangePassword = false;
  if (session?.user?.id && emailMatches) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mustChangePassword: true },
    });
    mustChangePassword = Boolean(user?.mustChangePassword);
  }

  return {
    ok: true,
    invitationId: invitation.id,
    email: invitedEmail,
    roleLabel: orgRoleLabel(invitation.role ?? ""),
    organizationName: invitation.organization.name,
    organizationId: invitation.organizationId,
    sessionEmail: sessionEmail || null,
    emailMatches,
    isAuthenticated: Boolean(session?.user),
    mustChangePassword,
  };
}
