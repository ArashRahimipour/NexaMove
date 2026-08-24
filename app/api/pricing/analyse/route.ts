import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { parseInvoiceFile, analyseInvoiceRows } from "@/lib/pricing/invoiceAnalyser";

export const runtime = "nodejs";

// Analysis only — never writes to rate cards. Results are for human review.
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows;
  try {
    rows = parseInvoiceFile(buffer);
  } catch {
    return NextResponse.json({ error: "Could not read this file — expected a CSV or XLSX invoice export." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows found in this file." }, { status: 400 });
  }

  const report = await analyseInvoiceRows(rows);
  return NextResponse.json({ report });
}
