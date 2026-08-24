import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/pricing/engine";

export interface RunsheetRawRow {
  trackingCode?: string;
  externalReference?: string;
  customerName?: string;
  postcode?: string;
  scheduledDate?: Date;
  portalStatus?: string;
  portalAmount?: number;
  raw: Record<string, unknown>;
}

// Column names vary between partner portals — no actual export sample has
// been supplied for any partner (Koala Living included), so this matches
// loosely by keyword, the same approach already used for carrier invoices
// in lib/pricing/invoiceAnalyser.ts, rather than assuming one fixed layout.
const COLUMN_ALIASES: Record<keyof Omit<RunsheetRawRow, "raw">, string[]> = {
  trackingCode: ["tracking code", "tracking", "nexamove ref", "nexamove reference"],
  externalReference: ["reference", "order number", "order ref", "consignment", "job number", "job ref", "order id", "ref"],
  customerName: ["customer", "customer name", "consignee", "name"],
  postcode: ["postcode", "postal code", "zip"],
  scheduledDate: ["delivery date", "scheduled date", "date"],
  portalStatus: ["status", "delivery status", "portal status"],
  portalAmount: ["amount", "charge", "settlement amount", "paid amount", "total"],
};

function str(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v).trim();
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

// Only used for the informational scheduledDate column (never for matching
// or reconciliation), so an unparseable date is dropped rather than
// failing the whole import. With cellDates:true (see parseRunsheetFile), a
// genuine date cell already arrives as a Date; this also accepts a plain
// text date string as a fallback for CSV cells xlsx didn't recognise as a
// date. Bare numeric strings (e.g. a stray "4000") are deliberately
// rejected — new Date("4000") silently parses as a bizarre far-future
// date rather than throwing.
function parseDate(v: unknown): Date | undefined {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v;
  if (typeof v !== "string" || !v.trim() || /^-?\d+(\.\d+)?$/.test(v.trim())) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function findColumn(headers: string[], aliases: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h === alias || h.includes(alias));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

export function parseRunsheetFile(buffer: Buffer): RunsheetRawRow[] {
  // cellDates:true so a genuine date cell (XLSX date formatting, or a
  // CSV cell that looks like a date) arrives as a JS Date directly,
  // rather than an Excel serial-day number that would otherwise have to
  // be guessed apart from a plain numeric column like postcode.
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (raw.length === 0) return [];

  const headers = Object.keys(raw[0]);
  const columnMap = Object.fromEntries(
    (Object.keys(COLUMN_ALIASES) as (keyof typeof COLUMN_ALIASES)[]).map((key) => [key, findColumn(headers, COLUMN_ALIASES[key])])
  ) as Record<keyof typeof COLUMN_ALIASES, string | undefined>;

  return raw.map((row) => ({
    trackingCode: columnMap.trackingCode ? str(row[columnMap.trackingCode]) : undefined,
    externalReference: columnMap.externalReference ? str(row[columnMap.externalReference]) : undefined,
    customerName: columnMap.customerName ? str(row[columnMap.customerName]) : undefined,
    postcode: columnMap.postcode ? str(row[columnMap.postcode]) : undefined,
    scheduledDate: columnMap.scheduledDate ? parseDate(row[columnMap.scheduledDate]) : undefined,
    portalStatus: columnMap.portalStatus ? str(row[columnMap.portalStatus]) : undefined,
    portalAmount: columnMap.portalAmount ? num(row[columnMap.portalAmount]) : undefined,
    raw: row,
  }));
}

// A dollar tolerance for cents-level rounding differences only — not a
// business rule about acceptable variance, just floating-point/rounding
// slack so a $0.01 rounding difference isn't reported as a discrepancy.
const RECONCILIATION_TOLERANCE_DOLLARS = 0.01;

interface MatchResult {
  deliveryId: string | null;
  matchType: "TRACKING_CODE" | "EXTERNAL_REFERENCE" | "NAME_AND_POSTCODE" | null;
}

// Exact matching only — never a fuzzy/best-guess match. A row that can't be
// tied to exactly one Delivery record stays unmatched for manual review.
async function matchRow(row: RunsheetRawRow): Promise<MatchResult> {
  if (row.trackingCode) {
    const delivery = await prisma.delivery.findUnique({ where: { trackingCode: row.trackingCode } });
    if (delivery) return { deliveryId: delivery.id, matchType: "TRACKING_CODE" };
  }
  if (row.externalReference) {
    const deliveries = await prisma.delivery.findMany({ where: { externalReference: row.externalReference } });
    if (deliveries.length === 1) return { deliveryId: deliveries[0].id, matchType: "EXTERNAL_REFERENCE" };
  }
  if (row.customerName && row.postcode) {
    const deliveries = await prisma.delivery.findMany({
      where: { customerName: { equals: row.customerName, mode: "insensitive" }, postcode: row.postcode },
    });
    if (deliveries.length === 1) return { deliveryId: deliveries[0].id, matchType: "NAME_AND_POSTCODE" };
  }
  return { deliveryId: null, matchType: null };
}

interface Reconciliation {
  status: "MATCHED" | "VARIANCE" | "PENDING" | "UNMATCHED";
  varianceAmount: number | null;
}

function reconcileRow(match: MatchResult, portalAmount: number | undefined, deliveryTotalCharge: number | null | undefined): Reconciliation {
  if (!match.deliveryId) return { status: "UNMATCHED", varianceAmount: null };
  if (portalAmount == null || deliveryTotalCharge == null) return { status: "PENDING", varianceAmount: null };
  const diff = round2(portalAmount - deliveryTotalCharge);
  if (Math.abs(diff) <= RECONCILIATION_TOLERANCE_DOLLARS) return { status: "MATCHED", varianceAmount: 0 };
  return { status: "VARIANCE", varianceAmount: diff };
}

export interface ImportRunsheetParams {
  buffer: Buffer;
  fileName: string;
  source: string;
  organisationId?: string;
  importedById: string;
}

export async function importRunsheet(params: ImportRunsheetParams) {
  const parsedRows = parseRunsheetFile(params.buffer);
  if (parsedRows.length === 0) {
    throw new Error("No rows found in this file.");
  }

  const rowsToCreate = [];
  let matchedCount = 0;
  for (const row of parsedRows) {
    const match = await matchRow(row);
    if (match.deliveryId) matchedCount++;
    const delivery = match.deliveryId
      ? await prisma.delivery.findUnique({ where: { id: match.deliveryId }, select: { totalCharge: true } })
      : null;
    const reconciliation = reconcileRow(match, row.portalAmount, delivery?.totalCharge);

    rowsToCreate.push({
      rawData: row.raw as object,
      externalReference: row.externalReference,
      matchType: match.matchType,
      deliveryId: match.deliveryId,
      portalStatus: row.portalStatus,
      portalAmount: row.portalAmount,
      scheduledDate: row.scheduledDate,
      reconciliationStatus: reconciliation.status,
      varianceAmount: reconciliation.varianceAmount,
    });
  }

  const runsheetImport = await prisma.runsheetImport.create({
    data: {
      organisationId: params.organisationId,
      source: params.source,
      fileName: params.fileName,
      importedById: params.importedById,
      totalRows: parsedRows.length,
      matchedRows: matchedCount,
      unmatchedRows: parsedRows.length - matchedCount,
      rows: { create: rowsToCreate },
    },
    include: { rows: { include: { delivery: { select: { trackingCode: true, customerName: true, totalCharge: true, status: true } } } } },
  });

  return runsheetImport;
}
