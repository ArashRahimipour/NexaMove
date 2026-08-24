import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.morningCommunicationLog.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.morningCommunicationLog.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "morning_comm.status_changed",
    recordType: "MorningCommunicationLog",
    recordId: updated.id,
    before: { status: existing.status },
    after: { status: updated.status },
  });

  return NextResponse.json({ log: updated });
}
