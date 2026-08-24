import { distanceMetres } from "@/lib/geofence";

// A sensible delivery WINDOW, never a minute-level promise — the brief is
// explicit about this. Uses the driver's live location + straight-line
// distance (with a standard road-distance fudge factor) + how many stops
// are still ahead of this one on the route, since a driver "10 minutes
// away by straight line" might still be 3 stops and an hour away in
// practice. This is a documented heuristic, not measured traffic/routing
// data — AVG_ROAD_SPEED_KMH, ROAD_DISTANCE_FACTOR and
// AVG_STOP_DWELL_MINUTES are assumptions, not calibrated from real data
// (none was supplied). Once a Google Maps API key with the Distance
// Matrix API enabled is configured, replacing the straight-line estimate
// with a real routed travel time is the natural upgrade — not done here
// since it can't be tested without real credentials and a quota to spend.
const AVG_ROAD_SPEED_KMH = 40;
const ROAD_DISTANCE_FACTOR = 1.3;
const AVG_STOP_DWELL_MINUTES = 20;

export interface EtaWindowInput {
  driverLat: number;
  driverLng: number;
  destLat: number;
  destLng: number;
  stopsAhead: number;
}

export interface EtaWindow {
  earliest: Date;
  latest: Date;
}

export function estimateEtaWindow(input: EtaWindowInput, now: Date = new Date()): EtaWindow {
  const straightLineKm = distanceMetres(input.driverLat, input.driverLng, input.destLat, input.destLng) / 1000;
  const roadKm = straightLineKm * ROAD_DISTANCE_FACTOR;
  const travelMinutes = (roadKm / AVG_ROAD_SPEED_KMH) * 60;
  const dwellMinutes = Math.max(0, input.stopsAhead) * AVG_STOP_DWELL_MINUTES;
  const estimatedMinutes = travelMinutes + dwellMinutes;

  // A window, not a point estimate: -25%/+35% around the estimate (wider
  // on the late side, since traffic/dwell overruns are more common than
  // arriving early).
  const earliestMinutes = estimatedMinutes * 0.75;
  const latestMinutes = estimatedMinutes * 1.35;

  return {
    earliest: new Date(now.getTime() + earliestMinutes * 60_000),
    latest: new Date(now.getTime() + latestMinutes * 60_000),
  };
}
