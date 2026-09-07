import "server-only";

import { prisma } from "@/lib/prisma";
import { verifyRadius } from "@/lib/attendance-geo";

export async function assertWithinBranchAttendanceRadius(params: {
  branchId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): Promise<{ distance: number; radius: number; uncertainty: number }> {
  const branch = await prisma.branch.findUnique({
    where: { id: params.branchId },
    select: {
      latitude: true,
      longitude: true,
      attendanceRadius: true,
    },
  });

  if (!branch) {
    throw new Error("Etablissement introuvable.");
  }

  if (
    branch.latitude == null ||
    branch.longitude == null ||
    !Number.isFinite(branch.latitude) ||
    !Number.isFinite(branch.longitude)
  ) {
    throw new Error(
      "L'etablissement n'est pas geolocalise. Configurez les coordonnees de la branche.",
    );
  }

  const radius = branch.attendanceRadius ?? 50;
  const { allowed, distance, uncertainty, effectiveRadius } = verifyRadius(
    params.latitude,
    params.longitude,
    branch.latitude,
    branch.longitude,
    radius,
    params.accuracy,
  );

  if (!allowed) {
    throw new Error(
      `Hors zone de pointage (${Math.round(distance)} m). Zone : ${radius} m autour du site, precision GPS prise en compte (${Math.round(effectiveRadius)} m). Recalez le point GPS de l'etablissement si besoin.`,
    );
  }

  return { distance, radius, uncertainty };
}
