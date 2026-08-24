import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const existing = await prisma.servicingSchedule.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.servicingSchedule.delete({ where: { id: params.id } });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "servicing_schedule.deleted",
    recordType: "ServicingSchedule",
    recordId: params.id,
    before: existing,
  });

  return NextResponse.json({ ok: true });
}
