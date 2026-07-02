"use server";

import z from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ZodError } from "zod";
import { auth } from "@/lib/auth";
import {
  consumeAdminCreatedUserPlainPassword,
  stashAdminCreatedUserPlainPassword,
} from "@/lib/admin-created-user-password";
import { generateSecurePassword } from "@/lib/generate-password";
import { prisma } from "@/lib/prisma";
import {
  createOrgMemberSchema,
  removeOrgMemberSchema,
  updateOrgMemberSchema,
  type CreateOrgMemberInput,
  type RemoveOrgMemberInput,
  updateUserSchema,
  type UpdateOrgMemberInput,
} from "./schema";
import { sendResetPasswordEmail } from "@/lib/email/send-reset-password-email";

function errMessage(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Une erreur est survenue.";
}

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}
type CreateOrganizationMemberResult =
  | {
      ok: true;
      userId: string;
      memberId: string;
    }
  | {
      ok: false;
      message: string;
    };
export async function createOrganizationMemberAction(
  input: CreateOrgMemberInput,
  options?: {
    revalidateMembersPage?: boolean;
  },
): Promise<CreateOrganizationMemberResult> {
  const parsed = createOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  console.log(input);

  const {
    organizationId,
    email,
    name,
    orgRole,
    prenom,
    sexe,
    postnom,
    telephone,
    dateOfBirth,
    address,
    statusUser,
  } = parsed.data;
  const h = await headers();
  const emailLower = email.toLowerCase();
  const password = generateSecurePassword(16);
  stashAdminCreatedUserPlainPassword(emailLower, password);

  let userId: string | null = null;
  try {
    const sexeMap: Record<string, "M" | "F"> = {
      masculin: "M",
      feminin: "F",
    };
    const created = await auth.api.createUser({
      body: {
        email: emailLower,
        name,
        password,
        role: "user",
        // Les champs personnalisés vont dans "data"
        data: {
          prenom,
          postnom,
          sexe: sexeMap[sexe as string],
          telephone,
          dateOfBirth,
          address,
          statusUser,
        },
      },
      headers: h,
    });
    const user = (created as { user?: { id: string } } | null)?.user;
    if (!user?.id) {
      return {
        ok: false,
        message: "Création du compte impossible (réponse inattendue).",
      };
    }
    userId = user.id;

    const member = await auth.api.addMember({
      body: {
        userId: user.id,
        role: orgRole as "owner",
        organizationId,
      },
      headers: h,
    });

    if (!member) {
      return {
        ok: false,
        message: "Membre introuvable après création.",
      };
    }

    if (options?.revalidateMembersPage) {
      revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    }

    return {
      ok: true,
      userId: user.id,
      memberId: member.id,
    };
  } catch (e) {
    consumeAdminCreatedUserPlainPassword(emailLower);
    if (userId) {
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    return { ok: false, message: errMessage(e) };
  }
}

export async function updateOrganizationMemberAction(
  input: UpdateOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = updateOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, memberId, orgRole } = parsed.data;
  const h = await headers();
  try {
    await auth.api.updateMemberRole({
      body: {
        memberId,
        organizationId,
        role: orgRole as "owner",
      },
      headers: h,
    });
    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    revalidatePath(
      `/admin/organizations/${organizationId}/members/${memberId}/edit`,
      "page",
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function updateUserAction(
  input: z.infer<typeof updateUserSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const {
    id,
    nom,
    postnom,
    prenom,
    dateOfBirth,
    sexe,
    telephone,
    email,
    address,
  } = parsed.data;

  try {
    const existUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existUser) {
      return { ok: false, message: "L'utilisateur n'existe pas" };
    }

    const sexeMap: Record<string, "M" | "F"> = {
      masculin: "M",
      feminin: "F",
    };

    await prisma.user.update({
      where: {
        id: id,
      },
      data: {
        name: `${nom} ${postnom} ${prenom}`,
        postnom,
        prenom,
        dateOfBirth,
        email,
        sexe: sexe ? sexeMap[sexe] : undefined,
        telephone,
        address,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function removeOrganizationMemberAction(
  input: RemoveOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = removeOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, memberId } = parsed.data;
  const h = await headers();
  try {
    await auth.api.removeMember({
      body: {
        memberIdOrEmail: memberId,
        organizationId,
      },
      headers: h,
    });
    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

import { hashPassword } from "better-auth/crypto";

export async function resetUserPasswordAction(input: { email: string }) {
  const email = input.email.toLowerCase();

  try {
    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      return { ok: false, message: "Utilisateur introuvable" };
    }

    const plainPassword = generateSecurePassword(16);
    stashAdminCreatedUserPlainPassword(email, plainPassword);

    // 🔐 Hash le mot de passe AVANT de le stocker
    const hashedPassword = await hashPassword(plainPassword);

    // Option B: Si le password est dans la table Account (Better Auth standard)
    await prisma.account.updateMany({
      where: {
        userId: user.id,
        providerId: "credential", // Important: cible uniquement email/password
      },
      data: { password: hashedPassword },
    });

    // 🔒 Optionnel : révoque toutes les sessions pour forcer reconnexion
    // await prisma.session.deleteMany({
    //   where: { userId: user.id },
    // });

    await sendResetPasswordEmail({
      to: email,
      name: user.name,
      temporaryPassword: plainPassword, // Envoie le clair par email
    });

    consumeAdminCreatedUserPlainPassword(email);
    return { ok: true };
  } catch (e) {
    consumeAdminCreatedUserPlainPassword(email);
    return { ok: false, message: errMessage(e) };
  }
}
