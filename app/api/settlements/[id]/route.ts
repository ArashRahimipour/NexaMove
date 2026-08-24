import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({ status: z.enum(["REVIEW", "APPROVED", "PAID"]) });

// Settlements are never re-computed after creation — approving/paying only
// changes status, so historical figures stay fixed even if rates change later.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.status === "APPROVED" && auth.session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin can approve settlements" }, { status: 403 });
  }

  const existing = await prisma.settlement.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Settlement not found" }, { status: 404 });

  const settlement = await prisma.settlement.update({
    where: { id: params.id },
    data: {
      status: parsed.data.status,
      approvedById: parsed.data.status === "APPROVED" ? auth.session.user.id : existing.approvedById,
      approvedAt: parsed.data.status === "APPROVED" ? new Date() : existing.approvedAt,
      paidAt: parsed.data.status === "PAID" ? new Date() : existing.paidAt,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "settlement.status_changed",
    recordType: "Settlement",
    recordId: settlement.id,
    before: { status: existing.status },
    after: { status: settlement.status },
  });

  return NextResponse.json({ settlement });
}
