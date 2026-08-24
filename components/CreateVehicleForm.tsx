"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateVehicleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ registration: "", type: "Van", make: "", model: "", maxCbm: "", maxWeight: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: form.registration,
          type: form.type,
          make: form.make || undefined,
          model: form.model || undefined,
          maxCbm: form.maxCbm ? Number(form.maxCbm) : undefined,
          maxWeight: form.maxWeight ? Number(form.maxWeight) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add vehicle");
      setForm({ registration: "", type: "Van", make: "", model: "", maxCbm: "", maxWeight: "" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add vehicle");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Add vehicle
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold">New vehicle</h2>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="field-label">Registration</label>
          <input required className="field-input" value={form.registration} onChange={(e) => update("registration", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Type</label>
          <input required className="field-input" value={form.type} onChange={(e) => update("type", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Make/model</label>
          <input className="field-input" value={form.make} onChange={(e) => update("make", e.target.value)} placeholder="Make" />
        </div>
        <div>
          <label className="field-label">Max CBM</label>
          <input type="number" step="0.1" className="field-input" value={form.maxCbm} onChange={(e) => update("maxCbm", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Max weight (kg)</label>
          <input type="number" className="field-input" value={form.maxWeight} onChange={(e) => update("maxWeight", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Adding…" : "Add vehicle"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
