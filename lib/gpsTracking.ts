import { distanceMetres } from "@/lib/geofence";

// Movement thresholds for writing a DriverLocation row. The brief is
// explicit: "do not cause unnecessary database writes every few seconds if
// the driver has not meaningfully moved." A reading is written only if the
// driver has moved far enough OR enough time has passed since the last
// write (so a stationary driver — e.g. parked at a stop — still produces
// one row every few minutes rather than none at all, which a live map
// needs to show them as "still there" rather than going stale/disappearing).
export const MIN_MOVE_METRES = 50;
export const MAX_STALE_SECONDS = 120;

export function shouldWriteLocation(
  prev: { lat: number; lng: number; recordedAt: Date } | null,
  next: { lat: number; lng: number; at: Date }
): boolean {
  if (!prev) return true;
  const secondsSince = (next.at.getTime() - prev.recordedAt.getTime()) / 1000;
  if (secondsSince >= MAX_STALE_SECONDS) return true;
  const moved = distanceMetres(prev.lat, prev.lng, next.lat, next.lng);
  return moved >= MIN_MOVE_METRES;
}

// A location is only useful for live tracking/ETA while fresh — a reading
// from 20 minutes ago (app backgrounded, GPS lost, driver logged out)
// should never be shown as "current".
export const LOCATION_FRESHNESS_SECONDS = 180;

export function isLocationFresh(recordedAt: Date, now: Date = new Date()): boolean {
  return (now.getTime() - recordedAt.getTime()) / 1000 <= LOCATION_FRESHNESS_SECONDS;
}
