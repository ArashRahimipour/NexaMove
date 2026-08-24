// Haversine distance between two lat/lng points, in metres.
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Default acceptable radius between a driver's GPS position and the delivery
// address before we warn (not block) that they appear to be somewhere else.
export const GEOFENCE_RADIUS_METRES = 300;

export function checkGeofence(
  driverLat: number,
  driverLng: number,
  addressLat: number | null,
  addressLng: number | null
): { verified: boolean | null; distanceM: number | null } {
  if (addressLat == null || addressLng == null) {
    return { verified: null, distanceM: null };
  }
  const distanceM = distanceMetres(driverLat, driverLng, addressLat, addressLng);
  return { verified: distanceM <= GEOFENCE_RADIUS_METRES, distanceM };
}
