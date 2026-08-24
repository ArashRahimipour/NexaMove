"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function ServicingScheduleForm({ organisations }: { organisations: { id: string; companyName: string }[] }) {
  const router = useRouter();
  const [organisationId, setOrganisationId] = useState(organisations[0]?.id ?? "");
  const [region, setRegion] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [minimumOrderThreshold, setMinimumOrderThreshold] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!organisationId || days.length === 0) {
      setError("Pick a client and at least one servicing day.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/servicing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId,
          region: region.trim(),
          daysOfWeek: days,
          minimumOrderThreshold: minimumOrderThreshold ? Number(minimumOrderThreshold) : null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? JSON.stringify(json.error) : "Failed to save");
      setRegion("");
      setDays([]);
      setMinimumOrderThreshold("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="font-semibold">Add / update a servicing schedule</p>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Client</label>
          <select className="field-input" value={organisationId} onChange={(e) => setOrganisationId(e.target.value)}>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.companyName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Region (blank = default/metro)</label>
          <input className="field-input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Cairns" />
        </div>
      </div>
      <div>
        <label className="field-label">Servicing days</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              type="button"
              key={d.value}
              onClick={() => toggleDay(d.value)}
              className={days.includes(d.value) ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Minimum order/volume threshold (optional)</label>
          <input
            type="number"
            step="0.01"
            className="field-input"
            value={minimumOrderThreshold}
            onChange={(e) => setMinimumOrderThreshold(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Notes</label>
          <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving…" : "Save schedule"}
      </button>
    </form>
  );
}
