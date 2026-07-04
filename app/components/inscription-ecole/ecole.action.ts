"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type CreateBranchInput = {
  name: string;
  code?: string;
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
};

export async function createBranch(data: CreateBranchInput) {
  if (!data.name || !data.organizationId) {
    return {
      success: false,
      message: "Le nom de l'école est obligatoire.",
    };
  }

  await prisma.branch.create({
    data: {
      name: data.name,
      code: data.code || null,
      image: data.image || null,
      adresse: data.adresse || null,
      ville: data.ville || null,
      pays: data.pays || "RDC",
      idnat: data.idnat || null,
      tel: data.tel || null,
      latitude: data.latitude,
      longitude: data.longitude,
      attendanceRadius: data.attendanceRadius || 100,
      organizationId: data.organizationId,
    },
  });

  revalidatePath("/inscription-ecole");

  return {
    success: true,
    message: "École créée avec succès.",
  };
}
