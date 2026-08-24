"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DeliveryRow {
  id: string;
  customerName: string;
  suburb: string;
  scanned: boolean;
}

interface ScanFeedback {
  ok: boolean;
  message: string;
}

// Warehouse collection scan screen. Deliberately just one big input and a
// list — a driver standing at a warehouse dock with a handheld/Bluetooth
// scanner needs almost zero taps, not a form. Most barcode scanners act as
// a keyboard (type the code, then Enter), which this input accepts
// natively; there's no camera-decode step to keep the surface simple.
export function DispatchScanner({
  routeId,
  routeName,
  deliveries: initialDeliveries,
}: {
  routeId: string;
  routeName: string;
  deliveries: DeliveryRow[];
}) {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [feedback]);

  const scannedCount = deliveries.filter((d) => d.scanned).length;
  const allScanned = deliveries.length > 0 && scannedCount === deliveries.length;

  async function submitScan(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/dispatch/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value, routeId, device: navigator.userAgent }),
      });
      const json = await res.json();
      if (res.ok && json.outcome === "SCANNED") {
        const name = json.delivery?.customerName ?? "Delivery";
        setFeedback({ ok: true, message: `✅ Scanned — ${name}` });
        setDeliveries((prev) => prev.map((d) => (d.id === json.delivery.id ? { ...d, scanned: true } : d)));
      } else {
        setFeedback({ ok: false, message: `❌ ${json.error ?? "Scan rejected"}` });
      }
    } catch {
      setFeedback({ ok: false, message: "❌ Network error — try again." });
    } finally {
      setCode("");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 border-b border-line bg-card px-4 py-3">
        <button onClick={() => router.push("/driver")} className="text-sm font-medium text-dim">
          ← Back to route
        </button>
        <h1 className="mt-1 text-lg font-bold">Scan for {routeName}</h1>
        <p className="text-sm text-dim">
          {scannedCount} of {deliveries.length} scanned
        </p>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <form onSubmit={submitScan} className="card space-y-3">
          <label className="field-label">Scan or enter consignment code</label>
          <input
            ref={inputRef}
            className="field-input py-4 text-center text-lg tracking-wide"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan barcode…"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button type="submit" className="btn-primary w-full py-4 text-base" disabled={submitting || !code.trim()}>
            {submitting ? "Checking…" : "Confirm scan"}
          </button>
        </form>

        {feedback && (
          <div
            role="alert"
            className={`card text-center font-medium ${feedback.ok ? "text-[#16A34A]" : "text-[#DC2626]"}`}
          >
            {feedback.message}
          </div>
        )}

        <div className="card space-y-2">
          <p className="mb-1 text-sm font-semibold">Today&apos;s stops</p>
          {deliveries.map((d) => (
            <div key={d.id} className="flex items-center justify-between border-b border-line py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{d.customerName}</p>
                <p className="text-xs text-dim">{d.suburb}</p>
              </div>
              <span className={`text-xs font-semibold ${d.scanned ? "text-[#16A34A]" : "text-muted"}`}>
                {d.scanned ? "✅ Scanned" : "Not scanned"}
              </span>
            </div>
          ))}
          {deliveries.length === 0 && <p className="text-sm text-dim">No stops on this route yet.</p>}
        </div>

        <button
          type="button"
          className="btn-primary w-full py-4"
          onClick={() => router.push("/driver")}
        >
          {allScanned ? "All loaded — back to route" : "Back to route"}
        </button>
        {!allScanned && deliveries.length > 0 && (
          <p className="text-center text-xs text-muted">
            {deliveries.length - scannedCount} stop{deliveries.length - scannedCount === 1 ? "" : "s"} not yet scanned.
          </p>
        )}
      </main>
    </div>
  );
}
