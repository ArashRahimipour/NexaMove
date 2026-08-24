"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunsheetUploadForm({ organisations }: { organisations: { id: string; companyName: string }[] }) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    if (!source.trim()) {
      setError('Describe where this runsheet came from first (e.g. "Koala Living portal export").');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", source.trim());
      if (organisationId) formData.append("organisationId", organisationId);
      const res = await fetch("/api/runsheets", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not import this runsheet.");
        return;
      }
      router.push(`/admin/runsheets/${json.runsheetImport.id}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Import a runsheet</h2>
      <p className="text-sm text-dim">
        CSV or XLSX exported from a third-party partner portal. Rows are matched to existing NexaMove deliveries by
        tracking code, order reference, or customer name + postcode — exact matches only, nothing is guessed. Each
        matched row is also compared against NexaMove&apos;s own charge for that delivery, and any variance is
        flagged for review.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Source</label>
          <input
            className="field-input"
            placeholder="e.g. Koala Living portal export"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Client (optional)</label>
          <select className="field-input" value={organisationId} onChange={(e) => setOrganisationId(e.target.value)}>
            <option value="">Unspecified</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.companyName}
              </option>
            ))}
          </select>
        </div>
      </div>
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="field-input"
      />
      {loading && <p className="text-sm text-dim">Importing…</p>}
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
    </div>
  );
}
