export type AttendanceGeoCoords = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

/** Erreur GPS typique entre deux appareils (téléphone / PC). */
export const MIN_GPS_UNCERTAINTY_METERS = 40;
/** Plafond pour éviter qu'une précision GPS déclarée à 5 km n'ouvre toute la ville. */
export const MAX_GPS_UNCERTAINTY_METERS = 80;
/**
 * Au-delà, ce n'est plus un fix GNSS (Wi‑Fi, IP, indoor). Windows/Chrome
 * annoncent souvent 40–500 m tout en plaçant le point à des km.
 * On n'applique le rayon que si le GPS est vraiment précis.
 */
export const PRECISE_GPS_ACCURACY_METERS = 25;

export function isPreciseGpsFix(accuracy?: number | null): boolean {
  return (
    accuracy != null &&
    Number.isFinite(accuracy) &&
    accuracy > 0 &&
    accuracy <= PRECISE_GPS_ACCURACY_METERS
  );
}

/** GPS flou : ne pas refuser le pointage (kiosque, PC de la branche, tablette). */
export function shouldSkipAttendanceGeofence(
  accuracy?: number | null,
): boolean {
  return !isPreciseGpsFix(accuracy);
}

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
