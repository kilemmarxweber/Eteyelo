"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createPartenaireSchema, type CreatePartenaireInput } from "./schema";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
export async function getCurrentBranch() {
  const { branchId, organizationId, userId } = await requireBranchContext();

  return {
    branchId,
    organizationId,
    userId,
  };
}
export async function createPartenaireAction(input: CreatePartenaireInput) {
  const { organizationId } = await getCurrentBranch();
  const parsed = createPartenaireSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const data = parsed.data;
  const slug = data.slug?.trim() || makeSlug(data.name);

  try {
    await prisma.partnaire.create({
      data: {
        name: data.name,
        slug,
        type: data.type || null,
        secteur: data.secteur || null,
        description: data.description || null,
        image: data.image,
        logo: data.logo || null,
        tel: data.tel,
        email: data.email || null,
        website: data.website || null,
        adresse: data.adresse || null,
        ville: data.ville || null,
        pays: data.pays || null,
        contactName: data.contactName || null,
        contactRole: data.contactRole || null,
        documentUrl: data.documentUrl || null,
        contractRef: data.contractRef || null,
        notes: data.notes || null,
        branchId: data.branchId || null,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
      },
    });

    revalidatePath(`/admin/organizations/${organizationId}/partenaires`);
    revalidatePath("/");

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible de créer le partenaire.",
    };
  }
}
