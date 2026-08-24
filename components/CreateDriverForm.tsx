"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateDriverForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [licenceExpiry, setLicenceExpiry] = useState("");
  const [paymentSplitPercent, setPaymentSplitPercent] = useState("60");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          password,
          licenceNumber: licenceNumber || undefined,
          licenceExpiry: licenceExpiry || undefined,
          paymentSplitPercent: paymentSplitPercent ? Number(paymentSplitPercent) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create driver");
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setLicenceNumber("");
      setLicenceExpiry("");
      setPaymentSplitPercent("60");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create driver");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Add driver
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold">New driver</h2>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Full name</label>
          <input required className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input
            required
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Phone (optional)</label>
          <input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Temporary password</label>
          <input
            required
            type="text"
            minLength={8}
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Licence number (optional)</label>
          <input className="field-input" value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Licence expiry (optional)</label>
          <input type="date" className="field-input" value={licenceExpiry} onChange={(e) => setLicenceExpiry(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Driver payment split %</label>
          <input
            type="number"
            min={0}
            max={100}
            className="field-input"
            value={paymentSplitPercent}
            onChange={(e) => setPaymentSplitPercent(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Creating…" : "Create driver"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
