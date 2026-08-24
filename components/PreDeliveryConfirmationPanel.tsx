"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Confirmation = {
  id: string;
  status: string;
  channel: string;
  notes: string | null;
  customerResponse: string | null;
  createdAt: string;
  staff: { name: string };
};

const STATUS_STYLE: Record<string, string> = {
  NOT_CONTACTED: "bg-elevated text-dim",
  CONTACT_ATTEMPTED: "bg-[#FFF7ED] text-[#C2410C]",
  CONFIRMED: "bg-[#DCFCE7] text-[#16A34A]",
  UNABLE_TO_CONTACT: "bg-[#FEF2F2] text-[#DC2626]",
  DETAILS_CHANGED: "bg-[#FEF2F2] text-[#DC2626]",
};

const STATUSES = ["NOT_CONTACTED", "CONTACT_ATTEMPTED", "CONFIRMED", "UNABLE_TO_CONTACT", "DETAILS_CHANGED"] as const;
const CHANNELS = ["PHONE", "SMS", "EMAIL", "IN_PERSON", "OTHER"] as const;

export function PreDeliveryConfirmationPanel({
  deliveryId,
  initialConfirmations,
}: {
  deliveryId: string;
  initialConfirmations: Confirmation[];
}) {
  const router = useRouter();
  const [confirmations, setConfirmations] = useState(initialConfirmations);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("CONTACT_ATTEMPTED");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("PHONE");
  const [notes, setNotes] = useState("");
  const [customerResponse, setCustomerResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/pre-delivery-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, channel, notes: notes || undefined, customerResponse: customerResponse || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? JSON.stringify(json.error) : "Failed to save");
      setConfirmations((prev) => [{ ...json.confirmation, staff: { name: "You" } }, ...prev]);
      setNotes("");
      setCustomerResponse("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const latest = confirmations[0];

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Pre-delivery confirmation</p>
        {latest && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[latest.status]}`}>
            {latest.status.replaceAll("_", " ")}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-[#DC2626]">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select className="field-input" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <input className="field-input" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <input
        className="field-input"
        placeholder="Customer response"
        value={customerResponse}
        onChange={(e) => setCustomerResponse(e.target.value)}
      />
      <button type="button" className="btn-primary w-full" disabled={submitting} onClick={submit}>
        {submitting ? "Saving…" : "Log contact attempt"}
      </button>

      {confirmations.length > 0 && (
        <div className="space-y-2 border-t border-line pt-2">
          {confirmations.map((c) => (
            <div key={c.id} className="text-sm">
              <p>
                <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                  {c.status.replaceAll("_", " ")}
                </span>
                {c.channel} · {c.staff.name} · {new Date(c.createdAt).toLocaleString("en-AU")}
              </p>
              {c.customerResponse && <p className="text-xs text-dim">Customer said: {c.customerResponse}</p>}
              {c.notes && <p className="text-xs text-muted">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
