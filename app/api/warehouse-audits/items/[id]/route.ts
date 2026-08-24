import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({
  resolved: z.boolean(),
});

// Marks a failed item's corrective action as resolved (or reopens it).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.warehouseAuditItem.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.warehouseAuditItem.update({
    where: { id: params.id },
    data: { resolved: parsed.data.resolved, resolvedAt: parsed.data.resolved ? new Date() : null },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "warehouse_audit_item.resolved",
    recordType: "WarehouseAuditItem",
    recordId: updated.id,
    before: { resolved: existing.resolved },
    after: { resolved: updated.resolved },
  });

  return NextResponse.json({ item: updated });
}
