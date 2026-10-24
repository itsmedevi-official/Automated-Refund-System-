const AZURE_MAPS_KEY = import.meta.env.VITE_AZURE_MAPS_KEY || "";

/** Degrees (float) -> micro-degrees (the on-chain representation). */
export function degreesToMicro(degrees) {
  return BigInt(Math.round(Number(degrees) * 1e6));
}

/** Micro-degrees (BigInt/number from the contract) -> degrees (float). */
export function microToDegrees(value) {
  return Number(value) / 1e6;
}

/**
 * Same equirectangular approximation as GeoUtils.sol, only used to show a live
 * preview in the UI. The authoritative value is always computed on-chain.
 */
export function equirectangularMeters(a, b) {
  const radius = 6371000;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const meanLat = toRad((a.lat + b.lat) / 2);
  return Math.round(radius * Math.sqrt(dLat * dLat + (Math.cos(meanLat) * dLon) ** 2));
}

function geoErrorMessage(error) {
  switch (error?.code) {
    case 1:
      return "Location permission was denied. Allow it in the browser to use the geolocation check.";
    case 2:
      return "Your position is unavailable. On a desktop demo you can type coordinates manually.";
    case 3:
      return "Getting your location timed out. Try again or enter the coordinates manually.";
    default:
      return error?.message || "Could not read your location.";
  }
}

/** Resolves to { lat, lon, accuracy, capturedAt } or rejects with a readable message. */
export function getCurrentPosition({ timeout = 15000, enableHighAccuracy = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser does not support the Geolocation API."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: Date.now(),
        }),
      (error) => reject(new Error(geoErrorMessage(error))),
      { enableHighAccuracy, timeout, maximumAge: 5000 }
    );
  });
}

/**
 * Optional Azure Maps reverse geocoding (the thesis mentions Azure Maps).
 * Without VITE_AZURE_MAPS_KEY the app simply shows raw coordinates.
 */
export async function reverseGeocode(lat, lon) {
  if (!AZURE_MAPS_KEY) return null;
  try {
    const url =
      "https://atlas.microsoft.com/reverseGeocode?api-version=2023-06-01" +
      `&subscription-key=${encodeURIComponent(AZURE_MAPS_KEY)}` +
      `&coordinates=${lon},${lat}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.features?.[0]?.properties?.address?.freeformAddress ?? null;
  } catch {
    return null;
  }
}
