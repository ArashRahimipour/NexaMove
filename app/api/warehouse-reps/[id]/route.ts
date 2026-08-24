import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({
  action: z.enum(["check_in", "check_out"]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.warehouseRepresentativeShift.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.warehouseRepresentativeShift.update({
    where: { id: params.id },
    data: parsed.data.action === "check_in" ? { checkInAt: new Date() } : { checkOutAt: new Date() },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: `warehouse_rep_shift.${parsed.data.action}`,
    recordType: "WarehouseRepresentativeShift",
    recordId: updated.id,
  });

  return NextResponse.json({ shift: updated });
}
