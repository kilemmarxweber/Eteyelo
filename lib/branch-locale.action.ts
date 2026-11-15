"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { resolveBranchUiLocale } from "@/lib/branch-locale";
import { prisma } from "@/lib/prisma";
import { isUserLocale, type UserLocale } from "@/lib/user-locale";

/**
 * Enregistre la langue UI pour une branche uniquement (Apparence).
 * N’altère pas User.locale ni le cookie global de session.
 */
export async function updateBranchLocaleAction(
  branchId: string,
  locale: UserLocale,
) {
  if (!branchId?.trim()) {
    throw new Error("Branche invalide");
  }
  if (!isUserLocale(locale)) {
    throw new Error("Langue invalide");
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Non authentifié");
  }

  const organizationId =
    session.organization?.id ?? session.session?.activeOrganizationId;
  if (!organizationId) {
    throw new Error("Organisation introuvable");
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: { id: true, organizationId: true, educationSystem: true },
  });
  if (!branch) {
    throw new Error("Branche introuvable");
  }

  await prisma.branch.update({
    where: { id: branch.id },
    data: { locale },
  });

  revalidatePath(
    `/admin/organizations/${branch.organizationId}/branches/${branch.id}`,
    "layout",
  );

  return {
    ok: true as const,
    locale: resolveBranchUiLocale({
      locale,
      educationSystem: branch.educationSystem,
    }),
  };
}
