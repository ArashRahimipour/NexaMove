"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Zone = {
  id: string;
  code: string;
  name: string;
  adjustmentModel: string;
  fixedSurcharge: number | null;
  multiplier: number | null;
  minimumCharge: number | null;
  needsConfirmation: boolean;
};

const MODELS = ["NONE", "FIXED_TABLE", "FIXED_SURCHARGE", "MULTIPLIER", "CLIENT_NEGOTIATED"];

export function ZoneEditor({ zone }: { zone: Zone }) {
  const router = useRouter();
  const [name, setName] = useState(zone.name);
  const [model, setModel] = useState(zone.adjustmentModel);
  const [surcharge, setSurcharge] = useState(zone.fixedSurcharge != null ? String(zone.fixedSurcharge) : "");
  const [multiplier, setMultiplier] = useState(zone.multiplier != null ? String(zone.multiplier) : "");
  const [minimumCharge, setMinimumCharge] = useState(zone.minimumCharge != null ? String(zone.minimumCharge) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/pricing/zones/${zone.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          adjustmentModel: model,
          fixedSurcharge: surcharge ? Number(surcharge) : null,
          multiplier: multiplier ? Number(multiplier) : null,
          minimumCharge: minimumCharge ? Number(minimumCharge) : null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-line last:border-0 align-top">
      <td className="px-4 py-2 font-medium">{zone.code}</td>
      <td className="px-4 py-2">
        <input className="field-input py-1" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="px-4 py-2">
        <select className="field-input py-1" value={model} onChange={(e) => setModel(e.target.value)}>
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        {model === "FIXED_SURCHARGE" && (
          <input type="number" step="0.01" placeholder="$ surcharge" className="field-input w-28 py-1" value={surcharge} onChange={(e) => setSurcharge(e.target.value)} />
        )}
        {model === "MULTIPLIER" && (
          <input type="number" step="0.01" placeholder="e.g. 1.15" className="field-input w-28 py-1" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
        )}
        {(model === "NONE" || model === "FIXED_TABLE" || model === "CLIENT_NEGOTIATED") && <span className="text-xs text-muted">—</span>}
      </td>
      <td className="px-4 py-2">
        <input type="number" step="0.01" placeholder="min $" className="field-input w-24 py-1" value={minimumCharge} onChange={(e) => setMinimumCharge(e.target.value)} />
      </td>
      <td className="px-4 py-2">
        <button type="button" onClick={save} disabled={saving} className="text-xs font-medium text-brand-600 hover:underline">
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
        {zone.needsConfirmation && !saved && <span className="ml-2 text-xs text-warn">Needs confirmation</span>}
      </td>
    </tr>
  );
}
