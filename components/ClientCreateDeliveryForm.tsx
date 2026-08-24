"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClientCreateDeliveryForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    externalReference: "",
    customerName: "",
    customerPhone: "",
    address: "",
    suburb: "",
    postcode: "",
    specialInstructions: "",
  });
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
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? "Failed to submit delivery");
      setForm({ externalReference: "", customerName: "", customerPhone: "", address: "", suburb: "", postcode: "", specialInstructions: "" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit delivery");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Submit new delivery
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold">Submit delivery</h2>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Your order reference</label>
          <input className="field-input" value={form.externalReference} onChange={(e) => update("externalReference", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Customer name</label>
          <input required className="field-input" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Customer phone</label>
          <input className="field-input" value={form.customerPhone} onChange={(e) => update("customerPhone", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Address</label>
          <input required className="field-input" value={form.address} onChange={(e) => update("address", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Suburb</label>
          <input required className="field-input" value={form.suburb} onChange={(e) => update("suburb", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Postcode</label>
          <input required maxLength={4} minLength={4} className="field-input" value={form.postcode} onChange={(e) => update("postcode", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Special instructions</label>
          <textarea className="field-input" rows={2} value={form.specialInstructions} onChange={(e) => update("specialInstructions", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Submitting…" : "Submit delivery"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
