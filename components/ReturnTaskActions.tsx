"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReturnTaskActions({
  returnTaskId,
  nextStatus,
  nextLabel,
}: {
  returnTaskId: string;
  nextStatus: string | null;
  nextLabel: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!nextStatus) return <span className="text-xs text-muted">Closed</span>;

  async function advance() {
    setLoading(true);
    try {
      const res = await fetch(`/api/returns/${returnTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="btn-secondary whitespace-nowrap" disabled={loading} onClick={advance}>
      {loading ? "Saving…" : `Mark: ${nextLabel}`}
    </button>
  );
}

export function RefreshSlaAlertsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/returns/check-sla", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setResult(`Checked ${json.checked}, raised ${json.alertsCreated} new alert${json.alertsCreated === 1 ? "" : "s"}.`);
        router.refresh();
      } else {
        setResult(json.error ?? "Failed to refresh.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button type="button" className="btn-secondary" disabled={loading} onClick={run}>
        {loading ? "Checking…" : "Refresh SLA alerts"}
      </button>
      {result && <span className="text-xs text-dim">{result}</span>}
    </div>
  );
}
