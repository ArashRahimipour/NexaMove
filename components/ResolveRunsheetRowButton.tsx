"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResolveRunsheetRowButton({ importId, rowId }: { importId: string; rowId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resolve() {
    const notes = window.prompt("Resolution note (why is this row settled / what was found)?");
    if (!notes || !notes.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/runsheets/${importId}/rows/${rowId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error ?? "Failed to resolve row");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn-secondary" disabled={loading} onClick={resolve}>
      {loading ? "…" : "Resolve"}
    </button>
  );
}
