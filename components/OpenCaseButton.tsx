"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OpenCaseButton({ deliveryId }: { deliveryId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/cases`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to open case");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn-secondary" disabled={loading} onClick={open}>
      {loading ? "Opening…" : "Open case"}
    </button>
  );
}
