"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RateCardLineEditor({ lineId, initialPrice, needsConfirmation }: { lineId: string; initialPrice: number | null; needsConfirmation: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initialPrice != null ? String(initialPrice) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/pricing/rate-cards/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price }),
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
    <div className="flex items-center gap-2">
      <span className="text-dim">$</span>
      <input
        type="number"
        min={0}
        step="0.01"
        className={`field-input w-24 py-1 ${needsConfirmation ? "border-warn" : ""}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="button" onClick={save} disabled={saving} className="text-xs font-medium text-brand-600 hover:underline">
        {saving ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
      {needsConfirmation && !saved && <span className="text-xs text-warn">Needs confirmation</span>}
    </div>
  );
}
