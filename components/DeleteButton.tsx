"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Generic delete control used across admin list pages (drivers, vehicles,
// routes, retail clients). The API decides whether a hard delete is safe —
// if the record has linked history it deactivates/cancels instead and says
// so here, rather than silently failing or losing records.
export function DeleteButton({ endpoint, itemLabel }: { endpoint: string; itemLabel: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirming" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function confirmDelete() {
    setState("loading");
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error ?? "Something went wrong.");
        setState("error");
        return;
      }
      setMessage(json.message ?? "Done.");
      setState("done");
      setTimeout(() => router.refresh(), 1200);
    } catch {
      setMessage("Network error — please try again.");
      setState("error");
    }
  }

  if (state === "done") return <span className="text-xs text-dim">{message}</span>;

  if (state === "loading") return <span className="text-xs text-muted">Deleting…</span>;

  if (state === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#DC2626]">{message}</span>
        <button className="text-xs text-muted underline" onClick={() => setState("idle")}>
          Dismiss
        </button>
      </div>
    );
  }

  if (state === "confirming") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-dim">Delete this {itemLabel}?</span>
        <button className="text-xs font-medium text-[#DC2626] underline" onClick={confirmDelete}>
          Yes, delete
        </button>
        <button className="text-xs text-muted underline" onClick={() => setState("idle")}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button className="text-xs font-medium text-[#DC2626] hover:underline" onClick={() => setState("confirming")}>
      Delete
    </button>
  );
}
