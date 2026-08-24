"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WarehouseRepCheckButtons({ id, checkInAt, checkOutAt }: { id: string; checkInAt: string | null; checkOutAt: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function act(action: "check_in" | "check_out") {
    setLoading(true);
    try {
      const res = await fetch(`/api/warehouse-reps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (checkOutAt) return <span className="text-xs text-muted">Checked out {new Date(checkOutAt).toLocaleTimeString("en-AU")}</span>;

  return (
    <div className="flex gap-2">
      {!checkInAt ? (
        <button type="button" className="btn-secondary" disabled={loading} onClick={() => act("check_in")}>
          Check in
        </button>
      ) : (
        <button type="button" className="btn-secondary" disabled={loading} onClick={() => act("check_out")}>
          Check out
        </button>
      )}
    </div>
  );
}
