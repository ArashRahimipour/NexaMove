"use client";

import { useEffect, useRef, useState } from "react";

interface LocationData {
  available: boolean;
  driverLat?: number;
  driverLng?: number;
  destLat?: number | null;
  destLng?: number | null;
  etaEarliest?: string | null;
  etaLatest?: string | null;
}

const POLL_MS = 15_000;

declare global {
  interface Window {
    google?: typeof google;
  }
}

// Graceful degradation, same pattern as this app's OpenAI/S3 integrations:
// without NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, this still shows the ETA window
// as plain text — no map, nothing faked. With a key, it loads the Maps JS
// API and shows the driver's live position + destination. Not live-tested
// against a real Google Maps key in this environment (no credentials
// available) — written to the documented Maps JavaScript API, but verify
// it once a real key is configured.
export function LiveTrackingMap({ trackingCode }: { trackingCode: string }) {
  const [data, setData] = useState<LocationData | null>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/track/${trackingCode}/location`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Best-effort — tracking page keeps working without live position.
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [trackingCode]);

  useEffect(() => {
    if (!apiKey || !data?.available || !mapDivRef.current || data.driverLat == null || data.driverLng == null) return;

    function render() {
      if (!window.google || !mapDivRef.current || data?.driverLat == null || data?.driverLng == null) return;
      const position = { lat: data.driverLat, lng: data.driverLng };
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(mapDivRef.current, {
          center: position,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
        });
      }
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new window.google.maps.Marker({
          map: mapRef.current,
          position,
          label: "🚚",
        });
      } else {
        driverMarkerRef.current.setPosition(position);
      }
      if (data?.destLat != null && data?.destLng != null) {
        new window.google.maps.Marker({
          map: mapRef.current,
          position: { lat: data.destLat, lng: data.destLng },
          label: "📍",
        });
      }
      mapRef.current.panTo(position);
    }

    if (window.google) {
      render();
      return;
    }

    const scriptId = "google-maps-js";
    if (document.getElementById(scriptId)) return;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [apiKey, data]);

  if (!data?.available) return null;

  return (
    <div className="card mt-4 space-y-2">
      <p className="font-semibold">Live tracking</p>
      {data.etaEarliest && data.etaLatest && (
        <p className="text-sm text-dim">
          Estimated arrival: {new Date(data.etaEarliest).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })} –{" "}
          {new Date(data.etaLatest).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
          <span className="ml-1 text-xs text-muted">(approximate)</span>
        </p>
      )}
      {apiKey ? (
        <div ref={mapDivRef} className="h-64 w-full rounded-lg" />
      ) : (
        <p className="text-xs text-muted">Live map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable it.</p>
      )}
    </div>
  );
}
