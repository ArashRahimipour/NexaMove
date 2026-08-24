"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DriverApproval = {
  id: string;
  driverId: string;
  approved: boolean;
  dedicated: boolean;
  primaryDriver: boolean;
  complianceStatus: string | null;
  driver: { name: string };
};

type VehicleApproval = {
  id: string;
  vehicleId: string;
  approved: boolean;
  dedicated: boolean;
  preferred: boolean;
  vehicle: { registration: string };
};

type Training = {
  id: string;
  driverId: string;
  trainingType: string;
  completedAt: string;
  expiresAt: string | null;
  documentUrl: string | null;
  driver: { name: string };
};

const TRAINING_TYPES = ["INDUCTION", "PRODUCT_HANDLING", "ASSEMBLY", "CUSTOMER_SERVICE"] as const;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FleetApprovalPanel({
  organisationId,
  drivers,
  vehicles,
  driverApprovals,
  vehicleApprovals,
  trainings,
}: {
  organisationId: string;
  drivers: { id: string; name: string }[];
  vehicles: { id: string; registration: string }[];
  driverApprovals: DriverApproval[];
  vehicleApprovals: VehicleApproval[];
  trainings: Training[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);

  async function saveDriverApproval(driverId: string, patch: Partial<DriverApproval>) {
    setSaving(driverId);
    const existing = driverApprovals.find((a) => a.driverId === driverId);
    await fetch("/api/client-driver-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organisationId,
        driverId,
        approved: existing?.approved ?? false,
        dedicated: existing?.dedicated ?? false,
        primaryDriver: existing?.primaryDriver ?? false,
        ...patch,
      }),
    });
    setSaving(null);
    router.refresh();
  }

  async function saveVehicleApproval(vehicleId: string, patch: Partial<VehicleApproval>) {
    setSaving(vehicleId);
    const existing = vehicleApprovals.find((a) => a.vehicleId === vehicleId);
    await fetch("/api/client-vehicle-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organisationId,
        vehicleId,
        approved: existing?.approved ?? false,
        dedicated: existing?.dedicated ?? false,
        preferred: existing?.preferred ?? false,
        ...patch,
      }),
    });
    setSaving(null);
    router.refresh();
  }

  const [trainingDriverId, setTrainingDriverId] = useState(drivers[0]?.id ?? "");
  const [trainingType, setTrainingType] = useState<(typeof TRAINING_TYPES)[number]>("INDUCTION");
  const [completedAt, setCompletedAt] = useState(new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState("");
  const [document, setDocument] = useState<string | null>(null);
  const [trainingSubmitting, setTrainingSubmitting] = useState(false);

  async function submitTraining() {
    setTrainingSubmitting(true);
    await fetch("/api/client-driver-trainings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organisationId,
        driverId: trainingDriverId,
        trainingType,
        completedAt,
        expiresAt: expiresAt || undefined,
        documentDataUrl: document ?? undefined,
      }),
    });
    setDocument(null);
    setExpiresAt("");
    setTrainingSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto p-0">
        <p className="px-4 pt-4 font-semibold">Driver approval</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-2">Driver</th>
              <th className="px-4 py-2">Approved</th>
              <th className="px-4 py-2">Dedicated</th>
              <th className="px-4 py-2">Primary</th>
              <th className="px-4 py-2">Compliance</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const a = driverApprovals.find((x) => x.driverId === d.id);
              return (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={a?.approved ?? false}
                      disabled={saving === d.id}
                      onChange={(e) => saveDriverApproval(d.id, { approved: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={a?.dedicated ?? false}
                      disabled={saving === d.id}
                      onChange={(e) => saveDriverApproval(d.id, { dedicated: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={a?.primaryDriver ?? false}
                      disabled={saving === d.id}
                      onChange={(e) => saveDriverApproval(d.id, { primaryDriver: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="field-input w-32 py-1 text-xs"
                      defaultValue={a?.complianceStatus ?? ""}
                      onBlur={(e) => saveDriverApproval(d.id, { complianceStatus: e.target.value || null })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto p-0">
        <p className="px-4 pt-4 font-semibold">Vehicle approval</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">Approved</th>
              <th className="px-4 py-2">Dedicated</th>
              <th className="px-4 py-2">Preferred</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const a = vehicleApprovals.find((x) => x.vehicleId === v.id);
              return (
                <tr key={v.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-medium">{v.registration}</td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={a?.approved ?? false}
                      disabled={saving === v.id}
                      onChange={(e) => saveVehicleApproval(v.id, { approved: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={a?.dedicated ?? false}
                      disabled={saving === v.id}
                      onChange={(e) => saveVehicleApproval(v.id, { dedicated: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={a?.preferred ?? false}
                      disabled={saving === v.id}
                      onChange={(e) => saveVehicleApproval(v.id, { preferred: e.target.checked })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card space-y-3">
        <p className="font-semibold">Product/competency training</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="field-input" value={trainingDriverId} onChange={(e) => setTrainingDriverId(e.target.value)}>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className="field-input" value={trainingType} onChange={(e) => setTrainingType(e.target.value as typeof trainingType)}>
            {TRAINING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <div>
            <label className="field-label">Completed</label>
            <input type="date" className="field-input" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Expiry/review (optional)</label>
            <input type="date" className="field-input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <label className="btn-secondary inline-block cursor-pointer px-3 py-1.5 text-xs">
          {document ? "Document attached" : "Attach document"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setDocument(await readFileAsDataUrl(f));
            }}
          />
        </label>
        <button type="button" className="btn-primary" disabled={trainingSubmitting} onClick={submitTraining}>
          {trainingSubmitting ? "Saving…" : "Record training"}
        </button>

        <div className="space-y-1 border-t border-line pt-2 text-sm">
          {trainings.map((t) => (
            <p key={t.id}>
              {t.driver.name} · {t.trainingType.replaceAll("_", " ")} · completed {new Date(t.completedAt).toLocaleDateString("en-AU")}
              {t.expiresAt && ` · expires ${new Date(t.expiresAt).toLocaleDateString("en-AU")}`}
              {t.documentUrl && (
                <>
                  {" "}
                  <a href={`/api/files/training-document/${t.id}`} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                    (document)
                  </a>
                </>
              )}
            </p>
          ))}
          {trainings.length === 0 && <p className="text-muted">No training recorded yet.</p>}
        </div>
      </div>
    </div>
  );
}
