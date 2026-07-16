"use server";

import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ensureAcademicPeriodsForBranch } from "@/lib/academic-periods";
import {
  isManagedBranchType,
  type ManagedBranchType,
} from "@/lib/academic-structure";
import { ensureUniqueIdentifier, generateCode } from "@/lib/generated-identifiers";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import { ensureDefaultCreneaux } from "@/lib/default-creneaux";

type CreateBranchInput = {
  name: string;
  image?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
  idnat?: string;
  tel?: string;
  latitude: number;
  longitude: number;
  attendanceRadius?: number;
  organizationId: string;
  typebranch: ManagedBranchType;
};

export async function createBranch(data: CreateBranchInput) {
  if (!data.name || !data.organizationId) {
    return {
      success: false,
      message: "Le nom de l'école est obligatoire.",
    };
  }

  if (!isManagedBranchType(data.typebranch)) {
    return {
      success: false,
      message: "Le type de branche est obligatoire.",
    };
  }

  const code = await ensureUniqueIdentifier({
    base: generateCode(data.name, "ECOLE"),
    separator: "",
    exists: async (value) =>
      Boolean(
        await prisma.branch.findFirst({
          where: { organizationId: data.organizationId, code: value },
          select: { id: true },
        }),
      ),
  });

  const branch = await prisma.branch.create({
    data: {
      name: data.name,
      code,
      image: data.image || KLAMBOCORE_DEFAULT_IMAGE_PATH,
      adresse: data.adresse || null,
      ville: data.ville || null,
      pays: data.pays || "RDC",
      idnat: data.idnat || null,
      tel: data.tel || null,
      latitude: data.latitude,
      longitude: data.longitude,
      attendanceRadius: data.attendanceRadius || 100,
      organizationId: data.organizationId,
      typebranch: data.typebranch,
    },
    select: { id: true },
  });

  if (data.typebranch === "PRIMAIRE") {
    await ensurePrimaryAcademicStructure(prisma, branch.id);
  }
  await ensureDefaultCreneaux(prisma, branch.id);

  await ensureAcademicPeriodsForBranch({
    branchId: branch.id,
    typebranch: data.typebranch,
  });

  revalidatePath("/inscription-ecole");

  return {
    success: true,
    message: "École créée avec succès.",
  };
}
