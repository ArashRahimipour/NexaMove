"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateOrganisationForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    abn: "",
    contactName: "",
    email: "",
    phone: "",
    portalUserEmail: "",
    portalUserPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add retail client");
      setForm({ companyName: "", abn: "", contactName: "", email: "", phone: "", portalUserEmail: "", portalUserPassword: "" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add retail client");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Add retail client
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold">New retail client</h2>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Company name</label>
          <input required className="field-input" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} />
        </div>
        <div>
          <label className="field-label">ABN</label>
          <input className="field-input" value={form.abn} onChange={(e) => update("abn", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Contact name</label>
          <input className="field-input" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Contact phone</label>
          <input className="field-input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>
      </div>
      <div className="border-t border-line pt-3">
        <p className="mb-2 text-sm font-medium">Portal login (optional — creates a Retail Client user for this org)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Login email</label>
            <input type="email" className="field-input" value={form.portalUserEmail} onChange={(e) => update("portalUserEmail", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Temporary password</label>
            <input className="field-input" value={form.portalUserPassword} onChange={(e) => update("portalUserPassword", e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Adding…" : "Add retail client"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
