import {
  clampGpsAccuracy,
  isPreciseGpsFix,
  MAX_GPS_UNCERTAINTY_METERS,
  MIN_GPS_UNCERTAINTY_METERS,
  shouldSkipAttendanceGeofence,
  verifyRadius,
} from "../lib/attendance-geo";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const schoolLat = -4.4419;
const schoolLng = 15.2663;
const metersToLat = (meters: number) => schoolLat + meters / 111_320;

assert(clampGpsAccuracy(5) === MIN_GPS_UNCERTAINTY_METERS, "GPS trop precis → 40 m");
assert(clampGpsAccuracy(undefined) === MIN_GPS_UNCERTAINTY_METERS, "sans accuracy → 40 m");
assert(
  clampGpsAccuracy(5000) === MAX_GPS_UNCERTAINTY_METERS,
  "accuracy extreme plafonnee a 80 m",
);

const nineMeters = verifyRadius(
  metersToLat(9),
  schoolLng,
  schoolLat,
  schoolLng,
  10,
  40,
);
assert(nineMeters.allowed, "9 m du site avec rayon 10 m et GPS 40 m → autorise");

const fifteenMetersNoAccuracy = verifyRadius(
  metersToLat(15),
  schoolLng,
  schoolLat,
  schoolLng,
  10,
);
assert(
  fifteenMetersNoAccuracy.allowed,
  "15 m / rayon 10 m : l'incertitude GPS evite le faux hors-zone",
);

const otherPhone = verifyRadius(
  metersToLat(50),
  schoolLng,
  schoolLat,
  schoolLng,
  50,
  40,
);
assert(otherPhone.allowed, "autre appareil a 50 m, rayon 50 m → autorise");

const farAway = verifyRadius(
  metersToLat(200),
  schoolLng,
  schoolLat,
  schoolLng,
  10,
  40,
);
assert(!farAway.allowed, "200 m / rayon 10 m → refuse");

assert(!isPreciseGpsFix(undefined), "sans accuracy → pas un fix GNSS");
assert(!isPreciseGpsFix(80), "80 m (Wi‑Fi/IP) → pas un fix GNSS");
assert(!isPreciseGpsFix(500), "500 m (message branche) → pas un fix GNSS");
assert(!isPreciseGpsFix(12222), "accuracy ville → pas un fix GNSS");
assert(isPreciseGpsFix(20), "20 m → fix GNSS");
assert(isPreciseGpsFix(25), "25 m → encore un fix GNSS");
assert(!isPreciseGpsFix(26), "40–500 m Windows/Chrome → trop flou");
assert(shouldSkipAttendanceGeofence(500), "500 m → ne pas bloquer");
assert(shouldSkipAttendanceGeofence(40), "40 m reseau → ne pas bloquer");
assert(!shouldSkipAttendanceGeofence(15), "15 m GNSS → appliquer le rayon");

console.log("test-attendance-geo: ok");
