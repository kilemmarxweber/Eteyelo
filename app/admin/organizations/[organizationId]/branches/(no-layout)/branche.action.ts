"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createBranchFormSchema, type CreateBranchFormValues } from "./schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ensureAcademicPeriodsForBranch } from "@/lib/academic-periods";
import {
  ensureUniqueIdentifier,
  generateCode,
} from "@/lib/generated-identifiers";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function getBranchNameAction(branchId: string) {
  if (!branchId) return null;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId },
    select: { name: true, image: true },
  });

  return branch;
}
async function uploadBranchFile(file: FormDataEntryValue | null) {
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

type BranchImagePayload = {
  logo: string;
  event: string[];
  gallery: string[];
  ecole: string[];
};

function emptyBranchImages(): BranchImagePayload {
  return {
    logo: "",
    event: [],
    gallery: [],
    ecole: [],
  };
}

function parseBranchImages(value: FormDataEntryValue | null): BranchImagePayload {
  if (typeof value !== "string" || !value.trim()) return emptyBranchImages();

  try {
    const data = JSON.parse(value) as Partial<BranchImagePayload>;

    return {
      logo: typeof data.logo === "string" ? data.logo : "",
      event: Array.isArray(data.event) ? data.event.filter(Boolean).map(String) : [],
      gallery: Array.isArray(data.gallery)
        ? data.gallery.filter(Boolean).map(String)
        : [],
      ecole: Array.isArray(data.ecole) ? data.ecole.filter(Boolean).map(String) : [],
    };
  } catch {
    return emptyBranchImages();
  }
}

async function uploadBranchFiles(files: FormDataEntryValue[]) {
  const uploaded: Array<{ originalName: string; storedName: string }> = [];

  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;

    const storedName = await uploadBranchFile(file);
    if (storedName) {
      uploaded.push({ originalName: file.name, storedName });
    }
  }

  return uploaded;
}

function replaceUploadedNames(
  current: string[],
  uploaded: Array<{ originalName: string; storedName: string }>,
) {
  const remaining = [...uploaded];
  const replaced = current.map((fileName) => {
    const matchIndex = remaining.findIndex((file) => file.originalName === fileName);
    if (matchIndex === -1) return fileName;

    const [match] = remaining.splice(matchIndex, 1);
    return match.storedName;
  });

  return [...replaced, ...remaining.map((file) => file.storedName)];
}

async function branchFormDataToValues(formData: FormData) {
  const logoFile = await uploadBranchFile(formData.get("logoFile"));
  const eventFiles = await uploadBranchFiles(formData.getAll("eventFiles"));
  const galleryFiles = await uploadBranchFiles(formData.getAll("galleryFiles"));
  const ecoleFiles = await uploadBranchFiles(formData.getAll("ecoleFiles"));
  const images = parseBranchImages(formData.get("image"));

  return {
    name: formData.get("name"),
    code: formData.get("code") || "",
    adresse: formData.get("adresse") || "",
    ville: formData.get("ville") || "",
    pays: formData.get("pays") || "",
    idnat: formData.get("idnat") || "",
    tel: formData.get("tel") || "",
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    attendanceRadius: formData.get("attendanceRadius"),
    typebranch: formData.get("typebranch"),
    image: {
      logo: logoFile || images.logo,
      event: replaceUploadedNames(images.event, eventFiles),
      gallery: replaceUploadedNames(images.gallery, galleryFiles),
      ecole: replaceUploadedNames(images.ecole, ecoleFiles),
    },
  };
}

async function resolveBranchValues(values: CreateBranchFormValues | FormData) {
  if (values instanceof FormData) {
    return branchFormDataToValues(values);
  }

  return values;
}

export async function createBranchAction(
  organizationId: string,
  values: CreateBranchFormValues | FormData,
) {
  const parsed = createBranchFormSchema.safeParse(await resolveBranchValues(values));

  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!organization) {
    return {
      data: null,
      error: "Organisation introuvable.",
    };
  }

  const code = await ensureUniqueIdentifier({
    base: generateCode(parsed.data.name, "BR", 16),
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.branch.findFirst({
          where: { organizationId, code: value },
          select: { id: true },
        }),
      ),
  });

  const branch = await prisma.branch.create({
    data: {
      organizationId,
      name: parsed.data.name,
      code,
      adresse: parsed.data.adresse?.trim() || null,
      tel: parsed.data.tel?.trim() || null,
      ville: parsed.data.ville?.trim() || null,
      pays: parsed.data.pays?.trim() || null,
      idnat: parsed.data.idnat?.trim() || null,
      image: parsed.data.image ?? [],
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      attendanceRadius: parsed.data.attendanceRadius,
      typebranch: parsed.data.typebranch,
    },
    select: { id: true },
  });

  await ensureAcademicPeriodsForBranch({
    branchId: branch.id,
    typebranch: parsed.data.typebranch,
  });

  revalidatePath(`/admin/organizations/${organizationId}/branches`);

  return {
    data: branch,
    error: null,
  };
}

export async function switchBranchAction(branchId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session?.id) {
    throw new Error("Session introuvable");
  }

  // Vérifie que la branche existe
  const branch = await prisma.branch.findUnique({
    where: {
      id: branchId,
    },
  });

  if (!branch) {
    throw new Error("Branche introuvable");
  }

  await prisma.session.update({
    where: {
      id: session.session.id,
    },
    data: {
      activeBranchId: branchId,
    },
  });

  return {
    success: true,
  };
}
export async function getBranchByIdAction(branchId: string) {
  if (!branchId) return null;

  return prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      name: true,
      code: true,
      adresse: true,
      tel: true,
      ville: true,
      pays: true,
      idnat: true,
      image: true,
      latitude: true,
      longitude: true,
      attendanceRadius: true,
      typebranch: true,
      organizationId: true,
    },
  });
}

export async function updateBranchAction(
  branchId: string,
  values: CreateBranchFormValues | FormData,
) {
  const parsed = createBranchFormSchema.safeParse(await resolveBranchValues(values));

  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const existingBranch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, organizationId: true },
  });

  if (!existingBranch) {
    return {
      data: null,
      error: "Établissement introuvable.",
    };
  }

  const code = await ensureUniqueIdentifier({
    base: generateCode(parsed.data.name, "BR", 16),
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.branch.findFirst({
          where: {
            organizationId: existingBranch.organizationId,
            code: value,
            id: { not: branchId },
          },
          select: { id: true },
        }),
      ),
  });

  const branch = await prisma.branch.update({
    where: { id: branchId },
    data: {
      name: parsed.data.name,
      code,
      adresse: parsed.data.adresse?.trim() || null,
      tel: parsed.data.tel?.trim() || null,
      ville: parsed.data.ville?.trim() || null,
      pays: parsed.data.pays?.trim() || null,
      idnat: parsed.data.idnat?.trim() || null,
      image: parsed.data.image ?? {
        logo: "",
        event: [],
        gallery: [],
        ecole: [],
      },
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      attendanceRadius: parsed.data.attendanceRadius,
      typebranch: parsed.data.typebranch,
    },
    select: { id: true, typebranch: true },
  });

  await ensureAcademicPeriodsForBranch({
    branchId,
    typebranch: branch.typebranch,
  });

  revalidatePath(
    `/admin/organizations/${existingBranch.organizationId}/branches`,
  );
  revalidatePath(
    `/admin/organizations/${existingBranch.organizationId}/branches/${branchId}/edit`,
  );

  return {
    data: branch,
    error: null,
  };
}
