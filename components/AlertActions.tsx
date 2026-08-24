"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AlertActions({ alertId, status }: { alertId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function act(action: "acknowledge" | "resolve") {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (status === "RESOLVED") return <span className="text-xs text-muted">Resolved</span>;

  return (
    <div className="flex gap-2">
      {status === "OPEN" && (
        <button className="btn-secondary" disabled={loading} onClick={() => act("acknowledge")}>
          Acknowledge
        </button>
      )}
      <button className="btn-secondary" disabled={loading} onClick={() => act("resolve")}>
        Resolve
      </button>
    </div>
  );
}
