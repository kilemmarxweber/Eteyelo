import "server-only";

import { prisma } from "@/lib/prisma";
import {
  shouldSkipAttendanceGeofence,
  verifyRadius,
} from "@/lib/attendance-geo";

export async function assertWithinBranchAttendanceRadius(params: {
  branchId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  /**
   * Par défaut : ignorer un GPS Wi‑Fi/IP trop flou (tablette, PC branche, kiosque).
   * Passer `false` pour forcer le rayon même avec une précision médiocre.
   */
  relaxCoarseGps?: boolean;
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
  const relaxCoarseGps = params.relaxCoarseGps !== false;

  if (relaxCoarseGps && shouldSkipAttendanceGeofence(params.accuracy)) {
    return {
      distance: 0,
      radius,
      uncertainty: params.accuracy ?? 0,
    };
  }

  const { allowed, distance, uncertainty, effectiveRadius } = verifyRadius(
    params.latitude,
    params.longitude,
    branch.latitude,
    branch.longitude,
    radius,
    params.accuracy,
  );

  if (!allowed) {
    const deviceAccuracy =
      params.accuracy != null && Number.isFinite(params.accuracy)
        ? Math.round(params.accuracy)
        : null;
    const devicePart =
      deviceAccuracy == null
        ? ""
        : `, appareil ${deviceAccuracy} m`;
    throw new Error(
      `Hors zone de pointage (${Math.round(distance)} m). Zone : ${radius} m autour du site, precision GPS prise en compte (${Math.round(effectiveRadius)} m${devicePart}). Recalez le point GPS de l'etablissement si besoin.`,
    );
  }

  return { distance, radius, uncertainty };
}
