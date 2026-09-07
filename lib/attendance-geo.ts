export type AttendanceGeoCoords = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

/** Erreur GPS typique entre deux appareils (téléphone / PC). */
export const MIN_GPS_UNCERTAINTY_METERS = 40;
/** Plafond pour éviter qu'une précision GPS déclarée à 5 km n'ouvre toute la ville. */
export const MAX_GPS_UNCERTAINTY_METERS = 80;

export function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function clampGpsAccuracy(accuracy?: number | null): number {
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy < 0) {
    return MIN_GPS_UNCERTAINTY_METERS;
  }
  return Math.min(
    MAX_GPS_UNCERTAINTY_METERS,
    Math.max(MIN_GPS_UNCERTAINTY_METERS, accuracy),
  );
}

/**
 * Le cercle d'incertitude GPS intersecte la zone autorisée.
 * Sans ça, un pointage à 9 m du site est souvent rejeté (GPS téléphone 20–50 m).
 */
export function verifyRadius(
  userLat: number,
  userLng: number,
  schoolLat: number,
  schoolLng: number,
  radius: number,
  accuracy?: number | null,
) {
  const distance = getDistanceInMeters(userLat, userLng, schoolLat, schoolLng);
  const uncertainty = clampGpsAccuracy(accuracy);
  const allowed = distance - uncertainty <= radius;

  return {
    allowed,
    distance,
    uncertainty,
    effectiveRadius: radius + uncertainty,
  };
}
