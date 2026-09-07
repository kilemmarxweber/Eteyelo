export type BrowserGeoCoords = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

function toCoords(position: GeolocationPosition): BrowserGeoCoords {
  const accuracy = position.coords.accuracy;
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy:
      Number.isFinite(accuracy) && accuracy > 0 ? accuracy : undefined,
  };
}

function oncePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalisation non disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
  });
}

/**
 * Prend plusieurs mesures GPS et garde la plus précise.
 * Évite qu'un seul getCurrentPosition (souvent 20–80 m d'erreur) bloque le pointage.
 */
export async function getCurrentPosition(): Promise<GeolocationPosition> {
  const first = await oncePosition();
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation?.watchPosition ||
    (Number.isFinite(first.coords.accuracy) && first.coords.accuracy <= 20)
  ) {
    return first;
  }

  return new Promise((resolve) => {
    let best = first;
    const started = Date.now();
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (
          !Number.isFinite(best.coords.accuracy) ||
          position.coords.accuracy < best.coords.accuracy
        ) {
          best = position;
        }
        if (best.coords.accuracy <= 15 || Date.now() - started >= 8000) {
          navigator.geolocation.clearWatch(watchId);
          resolve(best);
        }
      },
      () => {
        navigator.geolocation.clearWatch(watchId);
        resolve(best);
      },
      GEO_OPTIONS,
    );

    window.setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      resolve(best);
    }, 9000);
  });
}

export async function getCurrentGeoCoords(): Promise<BrowserGeoCoords> {
  const position = await getCurrentPosition();
  return toCoords(position);
}
