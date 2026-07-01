"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/prisma/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendProfileUpdatedEmail } from "@/lib/email/send-profile-updated-email";

const profileUpdateSchema = z.object({
  username: z.string().trim().min(3, "Nom d'utilisateur requis"),
  name: z.string().trim().min(2, "Nom requis"),
  prenom: z.string().trim().optional(),
  postnom: z.string().trim().optional(),
  sexe: z.string().trim().optional(),
  telephone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  image: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
});

export type ProfileFormState = {
  id: string;
  username: string;
  email: string;
  name: string;
  prenom: string;
  postnom: string;
  sexe: string;
  telephone: string;
  address: string;
  image: string;
  dateOfBirth: string;
};

async function getSessionUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function getCurrentProfileAction(): Promise<{
  profile?: ProfileFormState;
  error?: string;
}> {
  const userId = await getSessionUserId();

  if (!userId) {
    return { error: "Session introuvable" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      prenom: true,
      postnom: true,
      sexe: true,
      telephone: true,
      address: true,
      image: true,
      dateOfBirth: true,
    },
  });

  if (!user) {
    return { error: "Utilisateur introuvable" };
  }

  return {
    profile: {
      id: user.id,
      username: user.username ?? "",
      email: user.email ?? "",
      name: user.name ?? "",
      prenom: user.prenom ?? "",
      postnom: user.postnom ?? "",
      sexe: user.sexe ?? "",
      telephone: user.telephone ?? "",
      address: user.address ?? "",
      image: user.image ?? "",
      dateOfBirth: user.dateOfBirth
        ? user.dateOfBirth.toISOString().slice(0, 10)
        : "",
    },
  };
}

export async function updateCurrentProfileAction(
  values: z.infer<typeof profileUpdateSchema>,
) {
  const userId = await getSessionUserId();

  if (!userId) {
    return { success: false, error: "Session introuvable" };
  }

  const parsed = profileUpdateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Donnees invalides",
    };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!currentUser) {
    return { success: false, error: "Utilisateur introuvable" };
  }

  const data = parsed.data;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        name: data.name,
        prenom: data.prenom || null,
        postnom: data.postnom || null,
        sexe: data.sexe || null,
        telephone: data.telephone || null,
        address: data.address || null,
        image: data.image || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        prenom: true,
        postnom: true,
        sexe: true,
        telephone: true,
        address: true,
        image: true,
        dateOfBirth: true,
      },
    });

    if (updatedUser.email) {
      try {
        await sendProfileUpdatedEmail({
          to: updatedUser.email,
          name: updatedUser.name,
        });
      } catch (error) {
        console.error("[updateCurrentProfileAction] email profil:", error);
      }
    }

    revalidatePath("/admin/settings");

    return {
      success: true,
      profile: {
        ...updatedUser,
        email: updatedUser.email ?? "",
        username: updatedUser.username ?? "",
        prenom: updatedUser.prenom ?? "",
        postnom: updatedUser.postnom ?? "",
        sexe: updatedUser.sexe ?? "",
        telephone: updatedUser.telephone ?? "",
        address: updatedUser.address ?? "",
        image: updatedUser.image ?? "",
        dateOfBirth: updatedUser.dateOfBirth
          ? updatedUser.dateOfBirth.toISOString().slice(0, 10)
          : "",
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Ce nom d'utilisateur est deja utilise.",
      };
    }

    throw error;
  }
}
