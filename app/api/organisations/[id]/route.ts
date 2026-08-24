import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const organisation = await prisma.organisation.findUnique({ where: { id: params.id } });
  if (!organisation) return NextResponse.json({ error: "Retail client not found" }, { status: 404 });

  const [users, deliveries] = await Promise.all([
    prisma.user.count({ where: { organisationId: organisation.id } }),
    prisma.delivery.count({ where: { organisationId: organisation.id } }),
  ]);

  if (users + deliveries > 0) {
    await prisma.organisation.update({ where: { id: organisation.id }, data: { active: false } });
    await writeAuditLog({
      userId: auth.session.user.id,
      action: "organisation.deactivated",
      recordType: "Organisation",
      recordId: organisation.id,
      before: { active: true },
      after: { active: false },
    });
    return NextResponse.json({
      deleted: false,
      deactivated: true,
      message: "This retail client has portal users or deliveries, so it was deactivated instead of deleted.",
    });
  }

  await prisma.organisation.delete({ where: { id: organisation.id } });
  await writeAuditLog({
    userId: auth.session.user.id,
    action: "organisation.deleted",
    recordType: "Organisation",
    recordId: organisation.id,
    before: { companyName: organisation.companyName },
  });
  return NextResponse.json({ deleted: true, deactivated: false, message: "Retail client deleted." });
}
