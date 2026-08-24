"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WarehouseRepShiftForm({
  representatives,
  organisations,
}: {
  representatives: { id: string; name: string }[];
  organisations: { id: string; companyName: string }[];
}) {
  const router = useRouter();
  const [representativeId, setRepresentativeId] = useState(representatives[0]?.id ?? "");
  const [organisationId, setOrganisationId] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouse.trim() || !shift.trim()) {
      setError("Warehouse and shift are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/warehouse-reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ representativeId, organisationId: organisationId || undefined, warehouse, date, shift }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? JSON.stringify(json.error) : "Failed to save");
      setWarehouse("");
      setShift("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="font-semibold">Schedule a warehouse representative</p>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="field-input" value={representativeId} onChange={(e) => setRepresentativeId(e.target.value)}>
          {representatives.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select className="field-input" value={organisationId} onChange={(e) => setOrganisationId(e.target.value)}>
          <option value="">General</option>
          {organisations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.companyName}
            </option>
          ))}
        </select>
        <input className="field-input" placeholder="Warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} />
        <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="field-input" placeholder="Shift (e.g. 6am-2pm)" value={shift} onChange={(e) => setShift(e.target.value)} />
      </div>
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving…" : "Schedule"}
      </button>
    </form>
  );
}
