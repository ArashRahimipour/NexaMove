import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const resolveSchema = z.object({
  notes: z.string().min(1, "A resolution note is required."),
});

// Marks a flagged reconciliation row (VARIANCE or UNMATCHED) as manually
// resolved by a human — never auto-resolves or silently overwrites the
// computed variance amount, it just records that someone looked at it and
// why.
export async function POST(req: Request, { params }: { params: { id: string; rowId: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const row = await prisma.runsheetRow.findUnique({ where: { id: params.rowId } });
  if (!row || row.runsheetImportId !== params.id) {
    return NextResponse.json({ error: "Runsheet row not found" }, { status: 404 });
  }
  if (row.reconciliationStatus === "MATCHED") {
    return NextResponse.json({ error: "This row is already matched — nothing to resolve." }, { status: 409 });
  }

  const body = await req.json();
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.runsheetRow.update({
    where: { id: row.id },
    data: {
      resolvedById: auth.session.user.id,
      resolvedAt: new Date(),
      resolutionNotes: parsed.data.notes,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "runsheet_row.resolved",
    recordType: "RunsheetRow",
    recordId: row.id,
    before: { reconciliationStatus: row.reconciliationStatus },
    after: { notes: parsed.data.notes },
  });

  return NextResponse.json({ row: updated });
}
