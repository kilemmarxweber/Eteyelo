"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { createPartenaireSchema } from "./schema";
import {
  ensureUniqueIdentifier,
  generateSlug,
} from "@/lib/generated-identifiers";

async function uploadFile(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return "";

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name);
  const safeName = file.name
    .replace(ext, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const fileName = `${Date.now()}-${safeName}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);

  return fileName;
}

export async function createPartenaireAction(formData: FormData) {
  const { organizationId } = await requireBranchContext();

  const image = await uploadFile(formData.get("imageFile"));
  const logo = await uploadFile(formData.get("logoFile"));
  const documentUrl = await uploadFile(formData.get("documentFile"));

  const parsed = createPartenaireSchema.safeParse({
    organizationId,
    name: formData.get("name"),
    slug: formData.get("slug") || "",
    type: formData.get("type") || "",
    secteur: formData.get("secteur") || "",
    description: formData.get("description") || "",
    image,
    logo,
    tel: formData.get("tel"),
    email: formData.get("email") || "",
    website: formData.get("website") || "",
    adresse: formData.get("adresse") || "",
    ville: formData.get("ville") || "",
    pays: formData.get("pays") || "",
    contactName: formData.get("contactName") || "",
    contactRole: formData.get("contactRole") || "",
    documentUrl,
    contractRef: formData.get("contractRef") || "",
    notes: formData.get("notes") || "",
    branchId: formData.get("branchId") || "",
    isActive: formData.get("isActive") === "true",
    isFeatured: formData.get("isFeatured") === "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const data = parsed.data;

  const slug = await ensureUniqueIdentifier({
    base: generateSlug(data.name, "partenaire"),
    maxLength: 64,
    exists: async (value) =>
      Boolean(
        await prisma.partnaire.findUnique({
          where: { slug: value },
          select: { id: true },
        }),
      ),
  });

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

    return { ok: true };
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
export async function updatePartenaireAction(
  partenaireId: string,
  formData: FormData,
) {
  const { organizationId } = await requireBranchContext();

  const existing = await prisma.partnaire.findUnique({
    where: { id: partenaireId },
    select: {
      id: true,
      image: true,
      logo: true,
      documentUrl: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      message: "Partenaire introuvable.",
    };
  }

  const uploadedImage = await uploadFile(formData.get("imageFile"));
  const uploadedLogo = await uploadFile(formData.get("logoFile"));
  const uploadedDocument = await uploadFile(formData.get("documentFile"));

  const parsed = createPartenaireSchema.safeParse({
    organizationId,
    name: formData.get("name"),
    slug: formData.get("slug") || "",
    type: formData.get("type") || "",
    secteur: formData.get("secteur") || "",
    description: formData.get("description") || "",
    image: uploadedImage || existing.image,
    logo: uploadedLogo || existing.logo || "",
    tel: formData.get("tel"),
    email: formData.get("email") || "",
    website: formData.get("website") || "",
    adresse: formData.get("adresse") || "",
    ville: formData.get("ville") || "",
    pays: formData.get("pays") || "",
    contactName: formData.get("contactName") || "",
    contactRole: formData.get("contactRole") || "",
    documentUrl: uploadedDocument || existing.documentUrl || "",
    contractRef: formData.get("contractRef") || "",
    notes: formData.get("notes") || "",
    branchId: formData.get("branchId") || "",
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const data = parsed.data;

  try {
    const slug = await ensureUniqueIdentifier({
      base: generateSlug(data.name, "partenaire"),
      maxLength: 64,
      exists: async (value) =>
        Boolean(
          await prisma.partnaire.findFirst({
            where: {
              slug: value,
              NOT: {
                id: partenaireId,
              },
            },
            select: { id: true },
          }),
        ),
    });

    await prisma.partnaire.update({
      where: { id: partenaireId },
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

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour le partenaire.",
    };
  }
}
export async function deletePartenaireAction(partenaireId: string) {
  const { organizationId } = await requireBranchContext();

  try {
    const existing = await prisma.partnaire.findUnique({
      where: { id: partenaireId },
      select: { id: true },
    });

    if (!existing) {
      return {
        ok: false,
        message: "Partenaire introuvable.",
      };
    }

    await prisma.partnaire.delete({
      where: { id: partenaireId },
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
          : "Impossible de supprimer le partenaire.",
    };
  }
}
