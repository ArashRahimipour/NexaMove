"use client";

import { useEffect, useRef } from "react";

// Invisible background component — mounted once for the whole driver app
// (app/driver/layout.tsx), not per-page. Watches position via the browser's
// own change-driven callback (not a fixed poll loop) and additionally rate-
// limits its own POSTs to at most one every 20s client-side, on top of the
// server's own movement-threshold check (lib/gpsTracking.ts) — two
// independent reasons not to write on every reading, not just one.
// Silently does nothing if geolocation is unavailable or denied; never
// blocks or interrupts the driver's actual workflow.
const MIN_POST_INTERVAL_MS = 20_000;

export function DriverLocationTracker() {
  const lastPostRef = useRef<number>(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (sendingRef.current || now - lastPostRef.current < MIN_POST_INTERVAL_MS) return;
        lastPostRef.current = now;
        sendingRef.current = true;
        fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        })
          .catch(() => {
            // Best-effort — a dropped location update is never worth
            // surfacing an error to the driver mid-delivery.
          })
          .finally(() => {
            sendingRef.current = false;
          });
      },
      () => {
        // Permission denied or unavailable — nothing to do, driver
        // workflow continues normally without live tracking.
      },
      { enableHighAccuracy: false, maximumAge: 15_000, timeout: 20_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return null;
}
