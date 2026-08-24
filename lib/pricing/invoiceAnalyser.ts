import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { resolveCbmBand, round2 } from "@/lib/pricing/engine";

export interface InvoiceRow {
  consignmentNumber?: string;
  date?: string;
  from?: string;
  to?: string;
  zone?: string;
  description?: string;
  qty?: number;
  serviceCode?: string;
  weight?: number;
  cbm?: number;
  nett?: number;
  fuelLevy?: number;
  gst?: number;
  total?: number;
}

// Column names vary between carriers/exports — match loosely by keyword
// rather than requiring an exact header, but never guess at the VALUES.
const COLUMN_ALIASES: Record<keyof InvoiceRow, string[]> = {
  consignmentNumber: ["consignment", "consignment number", "con no", "con#"],
  date: ["date"],
  from: ["from", "origin", "pickup"],
  to: ["to", "destination", "delivery"],
  zone: ["zone", "zone/service", "zone code"],
  description: ["description", "desc"],
  qty: ["qty", "quantity"],
  serviceCode: ["service", "service/unit", "unit", "service code"],
  weight: ["weight", "wgt"],
  cbm: ["cubic", "cbm", "m3"],
  nett: ["nett", "net", "base"],
  fuelLevy: ["fuel levy", "fuel", "fsc"],
  gst: ["gst"],
  total: ["total"],
};

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function findColumn(headers: string[], aliases: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h === alias || h.includes(alias));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

export function parseInvoiceFile(buffer: Buffer): InvoiceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (raw.length === 0) return [];

  const headers = Object.keys(raw[0]);
  const columnMap = Object.fromEntries(
    (Object.keys(COLUMN_ALIASES) as (keyof InvoiceRow)[]).map((key) => [key, findColumn(headers, COLUMN_ALIASES[key])])
  ) as Record<keyof InvoiceRow, string | undefined>;

  return raw.map((row) => ({
    consignmentNumber: columnMap.consignmentNumber ? String(row[columnMap.consignmentNumber]) : undefined,
    date: columnMap.date ? String(row[columnMap.date]) : undefined,
    from: columnMap.from ? String(row[columnMap.from]) : undefined,
    to: columnMap.to ? String(row[columnMap.to]) : undefined,
    zone: columnMap.zone ? String(row[columnMap.zone]).trim() : undefined,
    description: columnMap.description ? String(row[columnMap.description]) : undefined,
    qty: columnMap.qty ? num(row[columnMap.qty]) : undefined,
    serviceCode: columnMap.serviceCode ? String(row[columnMap.serviceCode]).trim() : undefined,
    weight: columnMap.weight ? num(row[columnMap.weight]) : undefined,
    cbm: columnMap.cbm ? num(row[columnMap.cbm]) : undefined,
    nett: columnMap.nett ? num(row[columnMap.nett]) : undefined,
    fuelLevy: columnMap.fuelLevy ? num(row[columnMap.fuelLevy]) : undefined,
    gst: columnMap.gst ? num(row[columnMap.gst]) : undefined,
    total: columnMap.total ? num(row[columnMap.total]) : undefined,
  }));
}

export type Confidence = "Confirmed" | "High confidence" | "Medium confidence" | "Low confidence" | "Unknown";

export interface GroupReport {
  zone: string;
  serviceCode: string;
  cbmBandLabel: string;
  observations: number;
  mostCommonNett: number | null;
  average: number;
  median: number;
  min: number;
  max: number;
  confidence: Confidence;
  anomalies: { consignmentNumber?: string; nett: number; reason: string }[];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? round2((sorted[mid - 1] + sorted[mid]) / 2) : round2(sorted[mid]);
}

function mode(values: number[]): { value: number; count: number } {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = { value: values[0], count: 0 };
  for (const [value, count] of counts) if (count > best.count) best = { value, count };
  return best;
}

function classifyConfidence(observations: number, modeRatio: number): Confidence {
  if (observations < 3) return "Low confidence";
  if (modeRatio === 1) return "Confirmed";
  if (modeRatio >= 0.9) return "High confidence";
  if (modeRatio >= 0.6) return "Medium confidence";
  if (modeRatio >= 0.3) return "Low confidence";
  return "Unknown";
}

export interface AnalysisReport {
  totalRows: number;
  usableRows: number;
  groups: GroupReport[];
  observedFuelLevyPercentage: number | null;
  observedGstPercentage: number | null;
}

export async function analyseInvoiceRows(rows: InvoiceRow[]): Promise<AnalysisReport> {
  const usable = rows.filter((r) => r.nett != null && r.nett > 0);

  const standardServiceType = await prisma.serviceType.findUnique({ where: { code: "STANDARD" } });

  const groupKey = async (row: InvoiceRow) => {
    const zone = row.zone?.trim() || "Unspecified zone";
    const serviceCode = row.serviceCode?.trim() || row.description?.trim() || "Unspecified service";
    let cbmBandLabel = "Unknown CBM";
    if (row.cbm != null && standardServiceType) {
      const band = await resolveCbmBand(standardServiceType.id, row.cbm);
      cbmBandLabel = band?.label ?? "Unknown CBM";
    }
    return { key: `${zone}|||${serviceCode}|||${cbmBandLabel}`, zone, serviceCode, cbmBandLabel };
  };

  const groupsMap = new Map<string, { zone: string; serviceCode: string; cbmBandLabel: string; rows: InvoiceRow[] }>();
  for (const row of usable) {
    const { key, zone, serviceCode, cbmBandLabel } = await groupKey(row);
    const existing = groupsMap.get(key);
    if (existing) existing.rows.push(row);
    else groupsMap.set(key, { zone, serviceCode, cbmBandLabel, rows: [row] });
  }

  const groups: GroupReport[] = [];
  for (const g of groupsMap.values()) {
    const netts = g.rows.map((r) => round2(r.nett!));
    const m = mode(netts);
    const modeRatio = round2(m.count / netts.length);
    const confidence = classifyConfidence(netts.length, modeRatio);

    const anomalies = g.rows
      .filter((r) => Math.abs(round2(r.nett!) - m.value) > 0.01)
      .map((r) => ({
        consignmentNumber: r.consignmentNumber,
        nett: round2(r.nett!),
        reason: `Differs from this group's most common Nett ($${m.value.toFixed(2)}) — check for redelivery, assembly, special client rate, or distance/weight variation before treating as the same rule.`,
      }));

    groups.push({
      zone: g.zone,
      serviceCode: g.serviceCode,
      cbmBandLabel: g.cbmBandLabel,
      observations: netts.length,
      mostCommonNett: confidence === "Unknown" ? null : m.value,
      average: round2(netts.reduce((a, b) => a + b, 0) / netts.length),
      median: median(netts),
      min: Math.min(...netts),
      max: Math.max(...netts),
      confidence,
      anomalies,
    });
  }

  groups.sort((a, b) => b.observations - a.observations);

  const fuelRatios = usable
    .filter((r) => r.fuelLevy != null && r.nett! > 0)
    .map((r) => (r.fuelLevy! / r.nett!) * 100);
  const observedFuelLevyPercentage = fuelRatios.length > 0 ? round2(fuelRatios.reduce((a, b) => a + b, 0) / fuelRatios.length) : null;

  const gstRatios = usable
    .filter((r) => r.gst != null && r.nett! + (r.fuelLevy ?? 0) > 0)
    .map((r) => (r.gst! / (r.nett! + (r.fuelLevy ?? 0))) * 100);
  const observedGstPercentage = gstRatios.length > 0 ? round2(gstRatios.reduce((a, b) => a + b, 0) / gstRatios.length) : null;

  return {
    totalRows: rows.length,
    usableRows: usable.length,
    groups,
    observedFuelLevyPercentage,
    observedGstPercentage,
  };
}
