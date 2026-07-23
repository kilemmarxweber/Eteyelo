"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getOrganizationAuthContext } from "@/lib/auth/require-organization-permission";
import { sendOrganizationInvitationEmail } from "@/lib/email/send-organization-invitation-email";
import {
  getOrganizationInvitationsConfig,
  invitationExpiresAtFromConfig,
  isInvitableRole,
  organizationInvitationsConfigSchema,
  setOrganizationInvitationsConfig,
  type OrganizationInvitationsConfig,
} from "@/lib/invitations/config";
import { INVITATION_MESSAGES } from "@/lib/invitations/messages";
import { ALL_ORG_ROLE_SLUGS, isPlatformOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function errMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Action impossible.";
}

async function requirePlatformOwner() {
  const context = await getOrganizationAuthContext();
  if (!context) {
    return { ok: false as const, message: "Session introuvable." };
  }
  if (!isPlatformOwnerRole(context.appRole)) {
    return { ok: false as const, message: INVITATION_MESSAGES.notOwner };
  }
  return { ok: true as const, context };
}

const inviteSchema = z.object({
  organizationId: z.string().min(1),
  email: z
    .string()
    .trim()
    .min(1, "L’email est requis.")
    .email("Adresse email invalide."),
  role: z
    .string()
    .min(1, INVITATION_MESSAGES.roleRequired)
    .refine(
      (role) => (ALL_ORG_ROLE_SLUGS as readonly string[]).includes(role),
      INVITATION_MESSAGES.roleInvalid,
    ),
  resend: z.boolean().optional(),
});

const cancelSchema = z.object({
  organizationId: z.string().min(1),
  invitationId: z.string().min(1),
});

export async function getOrganizationInvitationsConfigAction(
  organizationId: string,
): Promise<
  | { ok: true; config: OrganizationInvitationsConfig; canManage: boolean }
  | { ok: false; message: string }
> {
  const context = await getOrganizationAuthContext();
  if (!context) {
    return { ok: false, message: "Session introuvable." };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!organization) {
    return { ok: false, message: INVITATION_MESSAGES.orgNotFound };
  }

  const config = await getOrganizationInvitationsConfig(organizationId);
  return {
    ok: true,
    config,
    canManage: isPlatformOwnerRole(context.appRole),
  };
}

export async function updateOrganizationInvitationsConfigAction(input: {
  organizationId: string;
  config: OrganizationInvitationsConfig;
}): Promise<
  | { ok: true; config: OrganizationInvitationsConfig }
  | { ok: false; message: string }
> {
  const owner = await requirePlatformOwner();
  if (!owner.ok) return owner;

  const parsedConfig = organizationInvitationsConfigSchema.safeParse(
    input.config,
  );
  if (!parsedConfig.success) {
    return { ok: false, message: "Configuration invalide." };
  }

  try {
    const config = await setOrganizationInvitationsConfig(
      input.organizationId,
      parsedConfig.data,
    );
    revalidatePath(`/admin/organizations/${input.organizationId}`);
    revalidatePath(
      `/admin/organizations/${input.organizationId}/members`,
    );
    revalidatePath(
      `/admin/organizations/${input.organizationId}/invitations`,
    );
    return { ok: true, config };
  } catch (error) {
    return { ok: false, message: errMessage(error) };
  }
}

export type PendingInvitationRow = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
};

export async function listPendingOrganizationInvitationsAction(
  organizationId: string,
): Promise<
  | { ok: true; invitations: PendingInvitationRow[]; canManage: boolean }
  | { ok: false; message: string }
> {
  const owner = await requirePlatformOwner();
  if (!owner.ok) return owner;

  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { ok: true, invitations, canManage: true };
}

export async function inviteOrganizationMemberAction(
  input: z.infer<typeof inviteSchema>,
): Promise<{ ok: true; invitationId: string } | { ok: false; message: string }> {
  const owner = await requirePlatformOwner();
  if (!owner.ok) return owner;

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const { organizationId, role, resend } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, metadata: true },
    });
    if (!organization) {
      return { ok: false, message: INVITATION_MESSAGES.orgNotFound };
    }

    const config = await getOrganizationInvitationsConfig(organizationId);
    if (!config.enabled) {
      return { ok: false, message: INVITATION_MESSAGES.disabled };
    }
    if (!isInvitableRole(role, config)) {
      return { ok: false, message: INVITATION_MESSAGES.roleInvalid };
    }

    const existingMember = await prisma.member.findFirst({
      where: {
        organizationId,
        user: { email },
      },
      select: { id: true },
    });
    if (existingMember) {
      return { ok: false, message: INVITATION_MESSAGES.alreadyMember };
    }

    // User déjà dans une autre org + mot de passe temporaire → bloquer.
    const existingUser = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        mustChangePassword: true,
        members: {
          where: { organizationId: { not: organizationId } },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (
      existingUser?.mustChangePassword &&
      existingUser.members.length > 0
    ) {
      return {
        ok: false,
        message: INVITATION_MESSAGES.mustChangePasswordFirst,
      };
    }

    const pending = await prisma.invitation.findFirst({
      where: {
        organizationId,
        email,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    const expiresAt = invitationExpiresAtFromConfig(config);
    let invitationId: string;

    if (pending) {
      if (!resend) {
        return { ok: false, message: INVITATION_MESSAGES.alreadyInvited };
      }
      await prisma.invitation.update({
        where: { id: pending.id },
        data: {
          role,
          expiresAt,
          inviterId: owner.context.userId,
        },
      });
      invitationId = pending.id;
    } else {
      // Annule les anciennes invitations pending pour le même email (re-invite).
      await prisma.invitation.updateMany({
        where: {
          organizationId,
          email,
          status: "pending",
        },
        data: { status: "canceled" },
      });

      const created = await prisma.invitation.create({
        data: {
          id: crypto.randomUUID(),
          email,
          role,
          status: "pending",
          organizationId,
          inviterId: owner.context.userId,
          expiresAt,
        },
        select: { id: true },
      });
      invitationId = created.id;
    }

    await sendOrganizationInvitationEmail({
      to: email,
      invitationId,
      organizationName: organization.name,
      role,
      inviterName: owner.context.session.user.name ?? null,
    });

    revalidatePath(`/admin/organizations/${organizationId}/members`);
    revalidatePath(`/admin/organizations/${organizationId}/invitations`);

    return { ok: true, invitationId };
  } catch (error) {
    return { ok: false, message: errMessage(error) };
  }
}

export async function cancelOrganizationInvitationAction(
  input: z.infer<typeof cancelSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const owner = await requirePlatformOwner();
  if (!owner.ok) return owner;

  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Données invalides." };
  }

  const { organizationId, invitationId } = parsed.data;

  try {
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, organizationId },
    });
    if (!invitation || invitation.status !== "pending") {
      return { ok: false, message: INVITATION_MESSAGES.notFoundOrExpired };
    }

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "canceled" },
    });

    revalidatePath(`/admin/organizations/${organizationId}/members`);
    revalidatePath(`/admin/organizations/${organizationId}/invitations`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errMessage(error) };
  }
}

export async function acceptOrganizationInvitationAction(
  invitationId: string,
): Promise<
  | { ok: true; organizationId: string }
  | {
      ok: false;
      message: string;
      needsAuth?: boolean;
      needsPasswordChange?: boolean;
      invitedEmail?: string;
      sessionEmail?: string;
    }
> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) {
    return {
      ok: false,
      message: INVITATION_MESSAGES.acceptNeedsLogin,
      needsAuth: true,
    };
  }

  try {
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        organizationId: true,
      },
    });

    if (
      !invitation ||
      invitation.status !== "pending" ||
      invitation.expiresAt < new Date()
    ) {
      return { ok: false, message: INVITATION_MESSAGES.notFoundOrExpired };
    }

    const invitedEmail = invitation.email.trim().toLowerCase();
    const sessionEmail = (session.user.email ?? "").trim().toLowerCase();

    if (!sessionEmail || invitedEmail !== sessionEmail) {
      return {
        ok: false,
        message: INVITATION_MESSAGES.acceptEmailMismatch,
        invitedEmail,
        sessionEmail: sessionEmail || undefined,
      };
    }

    const passwordState = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mustChangePassword: true },
    });

    if (passwordState?.mustChangePassword) {
      return {
        ok: false,
        message: INVITATION_MESSAGES.acceptMustChangePassword,
        needsPasswordChange: true,
      };
    }

    const result = await auth.api.acceptInvitation({
      body: { invitationId },
      headers: h,
    });

    if (!result?.member) {
      return { ok: false, message: INVITATION_MESSAGES.acceptFailed };
    }

    return { ok: true, organizationId: invitation.organizationId };
  } catch (error) {
    return { ok: false, message: errMessage(error) };
  }
}
