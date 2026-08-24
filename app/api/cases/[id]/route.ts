import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

// Customer service cases have no other records depending on them (their
// notes cascade-delete with them), so this is always a hard delete —
// no deactivate fallback needed, unlike drivers/vehicles/routes/orgs.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const caseRecord = await prisma.customerServiceCase.findUnique({
    where: { id: params.id },
    include: { delivery: { select: { customerName: true } } },
  });
  if (!caseRecord) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  await prisma.customerServiceCase.delete({ where: { id: caseRecord.id } });
  await writeAuditLog({
    userId: auth.session.user.id,
    action: "case.deleted",
    recordType: "CustomerServiceCase",
    recordId: caseRecord.id,
    before: { deliveryCustomer: caseRecord.delivery.customerName, status: caseRecord.status },
  });

  return NextResponse.json({ deleted: true, deactivated: false, message: "Case deleted." });
}
