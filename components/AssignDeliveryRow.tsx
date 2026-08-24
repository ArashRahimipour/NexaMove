"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssignDeliveryRow({ deliveryId, drivers }: { deliveryId: string; drivers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [driverId, setDriverId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function assign(overrides: { overrideCapacity?: boolean; overrideUnapproved?: boolean } = {}) {
    if (!driverId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dispatch/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId, driverId, ...overrides }),
      });
      const json = await res.json();
      if (res.status === 409 && json.error === "capacity_exceeded") {
        if (confirm(`${json.message}\n\nAssign anyway?`)) {
          await assign({ ...overrides, overrideCapacity: true });
          return;
        }
        setError(json.message);
        return;
      }
      if (res.status === 409 && json.error === "driver_not_approved") {
        if (confirm(`${json.message}\n\nConfirm authorised override and assign anyway?`)) {
          await assign({ ...overrides, overrideUnapproved: true });
          return;
        }
        setError(json.message);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Failed to assign");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select className="field-input !w-auto" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
        <option value="">Select driver…</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn-secondary" disabled={!driverId || submitting} onClick={() => assign()}>
        {submitting ? "Assigning…" : "Assign"}
      </button>
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}
