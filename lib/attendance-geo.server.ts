import "server-only";

import { prisma } from "@/lib/prisma";
import { verifyRadius } from "@/lib/attendance-geo";

export async function assertWithinBranchAttendanceRadius(params: {
  branchId: string;
  latitude: number;
  longitude: number;
}): Promise<{ distance: number; radius: number }> {
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

  const radius = branch.attendanceRadius ?? 10;
  const { allowed, distance } = verifyRadius(
    params.latitude,
    params.longitude,
    branch.latitude,
    branch.longitude,
    radius,
  );

  if (!allowed) {
    throw new Error(
      `Hors zone de pointage (${Math.round(distance)} m / ${radius} m autorises).`,
    );
  }

  return { distance, radius };
}
