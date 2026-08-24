import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { importRunsheet } from "@/lib/thirdPartyPortal/runsheetImport";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const imports = await prisma.runsheetImport.findMany({
    include: { organisation: { select: { companyName: true } }, importedBy: { select: { name: true } } },
    orderBy: { importedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ imports });
}

// Imports a runsheet exported from a third-party partner portal (Part D.27)
// and, in the same pass, computes a first-cut reconciliation against
// NexaMove's own delivery charges (Part D.28) — see
// lib/thirdPartyPortal/runsheetImport.ts for the matching/reconciliation
// rules. Never writes to any Delivery record; this is read-only analysis
// that a human reviews and resolves.
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const source = formData?.get("source");
  const organisationId = formData?.get("organisationId");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!source || typeof source !== "string" || !source.trim()) {
    return NextResponse.json({ error: "Describe where this runsheet came from (e.g. \"Koala Living portal export\")." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let runsheetImport;
  try {
    runsheetImport = await importRunsheet({
      buffer,
      fileName: file.name,
      source: source.trim(),
      organisationId: typeof organisationId === "string" && organisationId ? organisationId : undefined,
      importedById: auth.session.user.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read this file — expected a CSV or XLSX runsheet export." },
      { status: 400 }
    );
  }

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "runsheet.imported",
    recordType: "RunsheetImport",
    recordId: runsheetImport.id,
    after: { fileName: runsheetImport.fileName, totalRows: runsheetImport.totalRows, matchedRows: runsheetImport.matchedRows },
  });

  return NextResponse.json({ runsheetImport }, { status: 201 });
}
