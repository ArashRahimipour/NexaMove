"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;

export function MorningCommStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(next: string) {
    if (next === status) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/morning-comms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      {STATUSES.map((s) => (
        <button
          type="button"
          key={s}
          disabled={loading}
          onClick={() => setStatus(s)}
          className={s === status ? "btn-primary px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
        >
          {s.replaceAll("_", " ")}
        </button>
      ))}
    </div>
  );
}
