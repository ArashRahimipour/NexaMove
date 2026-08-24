"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEXT: Record<string, "REVIEW" | "APPROVED" | "PAID" | null> = {
  DRAFT: "REVIEW",
  REVIEW: "APPROVED",
  APPROVED: "PAID",
  PAID: null,
};

export function SettlementStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const next = NEXT[status];

  if (!next) return <span className="text-xs text-muted">Paid</span>;

  async function advance() {
    setLoading(true);
    try {
      const res = await fetch(`/api/settlements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error ?? "Failed to update settlement");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn-secondary" disabled={loading} onClick={advance}>
      {loading ? "…" : `Mark ${next.toLowerCase()}`}
    </button>
  );
}
