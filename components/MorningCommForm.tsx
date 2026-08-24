"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MORNING_COMM_ISSUE_TYPES, MORNING_COMM_ISSUE_LABEL } from "@/lib/morningComm";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Single-column, big-target layout — meant to be filled in on a tablet at
// the warehouse before the day's runs start, not at a desk.
export function MorningCommForm({
  drivers,
  vehicles,
  organisations,
}: {
  drivers: { id: string; name: string }[];
  vehicles: { id: string; registration: string }[];
  organisations: { id: string; companyName: string }[];
}) {
  const router = useRouter();
  const [issueType, setIssueType] = useState<(typeof MORNING_COMM_ISSUE_TYPES)[number]>("OVERNIGHT_EXCEPTION");
  const [organisationId, setOrganisationId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState("");
  const [actionRequired, setActionRequired] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment(await readFileAsDataUrl(file));
    e.target.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Describe the issue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/morning-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueType,
          organisationId: organisationId || undefined,
          driverId: driverId || undefined,
          vehicleId: vehicleId || undefined,
          description,
          actionRequired: actionRequired || undefined,
          responsiblePerson: responsiblePerson || undefined,
          attachmentDataUrl: attachment ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? JSON.stringify(json.error) : "Failed to save");
      setDescription("");
      setActionRequired("");
      setResponsiblePerson("");
      setAttachment(null);
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="font-semibold">Log a morning issue</p>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      {done && <p className="text-sm text-[#16A34A]">Logged.</p>}

      <div>
        <label className="field-label">Issue type</label>
        <select className="field-input py-3" value={issueType} onChange={(e) => setIssueType(e.target.value as typeof issueType)}>
          {MORNING_COMM_ISSUE_TYPES.map((t) => (
            <option key={t} value={t}>
              {MORNING_COMM_ISSUE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label">Description</label>
        <textarea
          className="field-input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened?"
        />
      </div>

      <div>
        <label className="field-label">Client (optional)</label>
        <select className="field-input py-3" value={organisationId} onChange={(e) => setOrganisationId(e.target.value)}>
          <option value="">General</option>
          {organisations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.companyName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label">Driver involved (optional)</label>
        <select className="field-input py-3" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
          <option value="">—</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label">Vehicle involved (optional)</label>
        <select className="field-input py-3" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">—</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registration}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label">Action required</label>
        <input className="field-input py-3" value={actionRequired} onChange={(e) => setActionRequired(e.target.value)} />
      </div>

      <div>
        <label className="field-label">Responsible person</label>
        <input className="field-input py-3" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)} />
      </div>

      <label className="btn-secondary block cursor-pointer py-3 text-center">
        {attachment ? "Photo attached" : "Attach photo"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAttachment} />
      </label>

      <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
