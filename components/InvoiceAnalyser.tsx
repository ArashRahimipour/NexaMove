"use client";

import { useState } from "react";

interface GroupReport {
  zone: string;
  serviceCode: string;
  cbmBandLabel: string;
  observations: number;
  mostCommonNett: number | null;
  average: number;
  median: number;
  min: number;
  max: number;
  confidence: string;
  anomalies: { consignmentNumber?: string; nett: number; reason: string }[];
}

interface Report {
  totalRows: number;
  usableRows: number;
  groups: GroupReport[];
  observedFuelLevyPercentage: number | null;
  observedGstPercentage: number | null;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  Confirmed: "bg-[#DCFCE7] text-[#16A34A]",
  "High confidence": "bg-[#DCFCE7] text-[#16A34A]",
  "Medium confidence": "bg-[#FFF7ED] text-[#C2410C]",
  "Low confidence": "bg-[#FEF9C3] text-[#A16207]",
  Unknown: "bg-elevated text-dim",
};

export function InvoiceAnalyser() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/pricing/analyse", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not analyse this file.");
        return;
      }
      setReport(json.report);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-semibold">Upload historical invoices</h2>
        <p className="text-sm text-dim">
          CSV or XLSX with columns like consignment number, date, from, to, zone, description, qty, service/unit,
          weight, cubic, nett, fuel levy, GST, total. This only analyses and reports — it never writes to your rate
          cards automatically.
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="field-input"
        />
        {loading && <p className="text-sm text-dim">Analysing…</p>}
        {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      </div>

      {report && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card">
              <p className="text-sm text-dim">Rows read</p>
              <p className="text-2xl font-bold">{report.totalRows}</p>
            </div>
            <div className="card">
              <p className="text-sm text-dim">Usable rows</p>
              <p className="text-2xl font-bold">{report.usableRows}</p>
            </div>
            <div className="card">
              <p className="text-sm text-dim">Observed fuel levy %</p>
              <p className="text-2xl font-bold">{report.observedFuelLevyPercentage != null ? `${report.observedFuelLevyPercentage}%` : "—"}</p>
            </div>
            <div className="card">
              <p className="text-sm text-dim">Observed GST %</p>
              <p className="text-2xl font-bold">{report.observedGstPercentage != null ? `${report.observedGstPercentage}%` : "—"}</p>
            </div>
          </div>

          <div className="space-y-3">
            {report.groups.map((g, i) => (
              <div key={i} className="card space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {g.zone} | {g.serviceCode} | {g.cbmBandLabel}
                  </p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONFIDENCE_COLOR[g.confidence] ?? "bg-elevated text-dim"}`}>
                    {g.confidence}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <p>
                    Observations: <span className="font-medium">{g.observations}</span>
                  </p>
                  <p>
                    Most common Nett:{" "}
                    <span className="font-medium">{g.mostCommonNett != null ? `$${g.mostCommonNett.toFixed(2)}` : "—"}</span>
                  </p>
                  <p>
                    Average: <span className="font-medium">${g.average.toFixed(2)}</span>
                  </p>
                  <p>
                    Median: <span className="font-medium">${g.median.toFixed(2)}</span>
                  </p>
                  <p>
                    Min / Max:{" "}
                    <span className="font-medium">
                      ${g.min.toFixed(2)} / ${g.max.toFixed(2)}
                    </span>
                  </p>
                </div>
                {g.anomalies.length > 0 && (
                  <div className="rounded-lg border border-warn/30 bg-elevated p-2 text-xs text-dim">
                    <p className="mb-1 font-medium text-ink">{g.anomalies.length} record(s) flagged for review:</p>
                    {g.anomalies.slice(0, 5).map((a, ai) => (
                      <p key={ai}>
                        {a.consignmentNumber ?? "—"}: ${a.nett.toFixed(2)} — {a.reason}
                      </p>
                    ))}
                    {g.anomalies.length > 5 && <p>…and {g.anomalies.length - 5} more.</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
