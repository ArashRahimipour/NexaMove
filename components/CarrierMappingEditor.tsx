"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CarrierMappingEditor({
  id,
  serviceTypes,
  currentServiceTypeId,
  confirmed,
}: {
  id: string;
  serviceTypes: { id: string; label: string }[];
  currentServiceTypeId: string | null;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentServiceTypeId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pricing/carrier-mappings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceTypeId: value }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select className="field-input py-1" value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">— Select —</option>
        {serviceTypes.map((st) => (
          <option key={st.id} value={st.id}>
            {st.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={save} disabled={saving || !value} className="text-xs font-medium text-brand-600 hover:underline">
        {saving ? "Saving…" : confirmed ? "Confirmed" : "Confirm"}
      </button>
    </div>
  );
}
