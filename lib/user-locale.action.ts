"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isUserLocale,
  USER_LOCALE_COOKIE,
  type UserLocale,
} from "@/lib/user-locale";

export async function updateUserLocaleAction(locale: UserLocale) {
  if (!isUserLocale(locale)) {
    throw new Error("Langue invalide");
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Non authentifié");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale },
  });

  const jar = await cookies();
  jar.set(USER_LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });

  revalidatePath("/admin", "layout");

  return { ok: true as const, locale };
}
