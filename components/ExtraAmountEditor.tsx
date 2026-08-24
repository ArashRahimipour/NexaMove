"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExtraAmountEditor({ id, initialAmount, needsConfirmation, unit }: { id: string; initialAmount: number | null; needsConfirmation: boolean; unit: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialAmount != null ? String(initialAmount) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/pricing/extras/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
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
      <input type="number" min={0} step="0.01" className="field-input w-24 py-1" value={value} onChange={(e) => setValue(e.target.value)} />
      <span className="text-xs text-muted">{unit}</span>
      <button type="button" onClick={save} disabled={saving} className="text-xs font-medium text-brand-600 hover:underline">
        {saving ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
      {needsConfirmation && !saved && <span className="text-xs text-warn">Needs confirmation</span>}
    </div>
  );
}
