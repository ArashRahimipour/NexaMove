"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Settings {
  companyName: string;
  abn: string | null;
  contactEmail: string | null;
  regions: string;
  geofenceRadiusMetres: number;
  photoRequiredForDelivery: boolean;
  signatureRequired: boolean;
  defaultDriverSplitPercent: number;
  gstPercentage: number;
}

export function AppSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: settings.companyName,
    abn: settings.abn ?? "",
    contactEmail: settings.contactEmail ?? "",
    regions: settings.regions,
    geofenceRadiusMetres: settings.geofenceRadiusMetres,
    photoRequiredForDelivery: settings.photoRequiredForDelivery,
    signatureRequired: settings.signatureRequired,
    defaultDriverSplitPercent: settings.defaultDriverSplitPercent,
    gstPercentage: settings.gstPercentage,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      {saved && <p className="text-sm text-[#16A34A]">Saved.</p>}

      <div>
        <h3 className="font-semibold">Company</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Company name</label>
            <input required className="field-input" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} />
          </div>
          <div>
            <label className="field-label">ABN</label>
            <input className="field-input" value={form.abn} onChange={(e) => update("abn", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Contact email</label>
            <input type="email" className="field-input" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Regions (comma separated)</label>
            <input className="field-input" value={form.regions} onChange={(e) => update("regions", e.target.value)} placeholder="QLD, NSW, VIC" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Delivery settings</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Geofence radius (metres)</label>
            <input
              type="number"
              className="field-input"
              value={form.geofenceRadiusMetres}
              onChange={(e) => update("geofenceRadiusMetres", Number(e.target.value))}
            />
          </div>
          <div className="flex items-end gap-4 pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.photoRequiredForDelivery}
                onChange={(e) => update("photoRequiredForDelivery", e.target.checked)}
              />
              Photo required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.signatureRequired} onChange={(e) => update("signatureRequired", e.target.checked)} />
              Signature required
            </label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Financial</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Default driver split %</label>
            <input
              type="number"
              min={0}
              max={100}
              className="field-input"
              value={form.defaultDriverSplitPercent}
              onChange={(e) => update("defaultDriverSplitPercent", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label">GST %</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              className="field-input"
              value={form.gstPercentage}
              onChange={(e) => update("gstPercentage", Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
