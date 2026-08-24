"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  WAREHOUSE_AUDIT_CATEGORIES,
  WAREHOUSE_AUDIT_CATEGORY_LABEL,
  SUGGESTED_CRITICAL_CATEGORIES,
  type WarehouseAuditCategory,
} from "@/lib/warehouseAudit";

type Result = "PASS" | "FAIL" | "NOT_APPLICABLE";

interface ItemState {
  result: Result | null;
  critical: boolean;
  correctiveAction: string;
  dueDate: string;
  photoDataUrl: string | null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function initialItems(): Record<WarehouseAuditCategory, ItemState> {
  return Object.fromEntries(
    WAREHOUSE_AUDIT_CATEGORIES.map((c) => [
      c,
      { result: null, critical: SUGGESTED_CRITICAL_CATEGORIES.includes(c), correctiveAction: "", dueDate: "", photoDataUrl: null },
    ])
  ) as Record<WarehouseAuditCategory, ItemState>;
}

export function WarehouseAuditForm({
  drivers,
  vehicles,
  organisations,
}: {
  drivers: { id: string; name: string }[];
  vehicles: { id: string; registration: string }[];
  organisations: { id: string; companyName: string }[];
}) {
  const router = useRouter();
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Record<WarehouseAuditCategory, ItemState>>(initialItems);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function updateItem(category: WarehouseAuditCategory, patch: Partial<ItemState>) {
    setItems((prev) => ({ ...prev, [category]: { ...prev[category], ...patch } }));
  }

  async function handlePhoto(category: WarehouseAuditCategory, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    updateItem(category, { photoDataUrl: await readFileAsDataUrl(file) });
    e.target.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!driverId) {
      setError("Select a driver.");
      return;
    }
    const entries = Object.entries(items) as [WarehouseAuditCategory, ItemState][];
    const unset = entries.filter(([, v]) => v.result === null);
    if (unset.length > 0) {
      setError(`Set a result for every item — ${unset.length} still unset.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/warehouse-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId,
          vehicleId: vehicleId || undefined,
          organisationId: organisationId || undefined,
          notes: notes || undefined,
          items: entries.map(([category, v]) => ({
            category,
            result: v.result,
            critical: v.result === "FAIL" ? v.critical : false,
            correctiveAction: v.result === "FAIL" ? v.correctiveAction || undefined : undefined,
            dueDate: v.result === "FAIL" && v.dueDate ? v.dueDate : undefined,
            photoDataUrl: v.photoDataUrl ?? undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? JSON.stringify(json.error) : "Failed to save audit");
      setDone(true);
      setItems(initialItems());
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save audit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <p className="font-semibold">New weekly warehouse audit</p>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      {done && <p className="text-sm text-[#16A34A]">Audit saved.</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="field-label">Driver</label>
          <select className="field-input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Vehicle (optional)</label>
          <select className="field-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">—</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registration}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Client (optional)</label>
          <select className="field-input" value={organisationId} onChange={(e) => setOrganisationId(e.target.value)}>
            <option value="">General</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.companyName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {WAREHOUSE_AUDIT_CATEGORIES.map((category) => {
          const item = items[category];
          return (
            <div key={category} className="border-b border-line pb-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{WAREHOUSE_AUDIT_CATEGORY_LABEL[category]}</p>
                <div className="flex gap-1.5">
                  {(["PASS", "FAIL", "NOT_APPLICABLE"] as Result[]).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => updateItem(category, { result: r })}
                      className={
                        item.result === r
                          ? r === "FAIL"
                            ? "rounded-md bg-[#DC2626] px-2.5 py-1 text-xs font-semibold text-white"
                            : "btn-primary px-2.5 py-1 text-xs"
                          : "btn-secondary px-2.5 py-1 text-xs"
                      }
                    >
                      {r === "NOT_APPLICABLE" ? "N/A" : r === "PASS" ? "Pass" : "Fail"}
                    </button>
                  ))}
                </div>
              </div>
              {item.result === "FAIL" && (
                <div className="mt-2 space-y-2 rounded-lg bg-elevated p-3">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={item.critical}
                      onChange={(e) => updateItem(category, { critical: e.target.checked })}
                    />
                    Critical — raises an alert immediately
                  </label>
                  <input
                    className="field-input py-1.5 text-sm"
                    placeholder="Corrective action"
                    value={item.correctiveAction}
                    onChange={(e) => updateItem(category, { correctiveAction: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="field-input w-40 py-1.5 text-sm"
                      value={item.dueDate}
                      onChange={(e) => updateItem(category, { dueDate: e.target.value })}
                    />
                    <label className="btn-secondary cursor-pointer px-2.5 py-1 text-xs">
                      {item.photoDataUrl ? "Photo added" : "Add photo"}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhoto(category, e)} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className="field-label">Notes</label>
        <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving…" : "Save audit"}
      </button>
    </form>
  );
}
