"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  ["UNDETERMINED", "Undetermined / under investigation"],
  ["WAREHOUSE", "Warehouse"],
  ["SUPPLIER", "Supplier"],
  ["MANUFACTURING", "Manufacturing"],
  ["DRIVER", "Driver"],
  ["OFFSIDER", "Offsider"],
  ["TRANSPORT", "Transport"],
  ["CUSTOMER", "Customer"],
  ["PACKAGING", "Packaging"],
  ["OTHER", "Other"],
  ["NO_RESPONSIBILITY", "No responsibility established"],
] as const;

export function DamageResponsibilityForm({
  deliveryId,
  damageReportId,
  current,
}: {
  deliveryId: string;
  damageReportId: string;
  current: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/damage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ damageReportId, responsibility: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update responsibility");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update responsibility");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="field-input !w-auto" value={value} onChange={(e) => setValue(e.target.value)}>
        {OPTIONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <button type="button" className="btn-secondary" disabled={saving || value === current} onClick={save}>
        {saving ? "Saving…" : "Set responsibility"}
      </button>
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}
