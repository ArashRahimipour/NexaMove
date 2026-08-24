"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResolveAuditItemButton({ itemId, resolved }: { itemId: string; resolved: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/warehouse-audits/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !resolved }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={resolved ? "btn-secondary" : "btn-primary"} disabled={loading} onClick={toggle}>
      {loading ? "Saving…" : resolved ? "Resolved — reopen" : "Mark resolved"}
    </button>
  );
}
