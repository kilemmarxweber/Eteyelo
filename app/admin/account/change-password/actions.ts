"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function clearMustChangePasswordAction() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false as const, message: "Non authentifié." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mustChangePassword: false },
  });

  return { ok: true as const };
}
