"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserTheme, type UserTheme } from "@/lib/user-theme";

export async function updateUserThemeAction(theme: UserTheme) {
  if (!isUserTheme(theme)) {
    throw new Error("Thème invalide");
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Non authentifié");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme },
  });

  return { ok: true as const, theme };
}
