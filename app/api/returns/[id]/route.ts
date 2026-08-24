import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { canAdvanceReturnTask, computeReturnSlaDeadline } from "@/lib/returns";
import type { ReturnTaskStatus } from "@prisma/client";

const patchSchema = z.object({
  status: z.enum(["CUSTOMER_COLLECTION", "DRIVER_POSSESSION", "IN_TRANSIT_TO_WAREHOUSE", "WAREHOUSE_RETURNED", "SCANNED_IN", "CLOSED"]),
  warehouse: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("DRIVER", "ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { status, warehouse, notes } = parsed.data;

  const existing = await prisma.returnTask.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Return task not found" }, { status: 404 });

  if (auth.session.user.role === "DRIVER" && existing.driverId !== auth.session.user.id) {
    return NextResponse.json({ error: "Not your return task" }, { status: 403 });
  }

  if (!canAdvanceReturnTask(existing.status, status)) {
    return NextResponse.json(
      { error: `Cannot move a return task from ${existing.status} to ${status} — stages only move forward.` },
      { status: 409 }
    );
  }

  const now = new Date();
  const data: Record<string, unknown> = { status, warehouse: warehouse ?? existing.warehouse, notes: notes ?? existing.notes };

  if (status === "DRIVER_POSSESSION" && !existing.collectedAt) {
    data.collectedAt = now;
    data.slaDeadline = computeReturnSlaDeadline(now);
  }
  if (status === "IN_TRANSIT_TO_WAREHOUSE") data.inTransitAt = now;
  if (status === "WAREHOUSE_RETURNED") data.warehouseReturnedAt = now;
  if (status === "SCANNED_IN") {
    data.scannedInAt = now;
    data.scannedInById = auth.session.user.id;
  }
  if (status === "CLOSED") data.closedAt = now;

  const updated = await prisma.returnTask.update({ where: { id: params.id }, data: data as { status: ReturnTaskStatus } });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "return_task.status_changed",
    recordType: "ReturnTask",
    recordId: updated.id,
    before: { status: existing.status },
    after: { status: updated.status },
  });

  return NextResponse.json({ returnTask: updated });
}
