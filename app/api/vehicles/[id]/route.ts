import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.id } });
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const [drivers, routes] = await Promise.all([
    prisma.driver.count({ where: { vehicleId: vehicle.id } }),
    prisma.route.count({ where: { vehicleId: vehicle.id } }),
  ]);

  if (drivers + routes > 0) {
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { active: false } });
    await writeAuditLog({
      userId: auth.session.user.id,
      action: "vehicle.deactivated",
      recordType: "Vehicle",
      recordId: vehicle.id,
      before: { active: true },
      after: { active: false },
    });
    return NextResponse.json({
      deleted: false,
      deactivated: true,
      message: "This vehicle is linked to drivers or routes, so it was deactivated instead of deleted.",
    });
  }

  await prisma.vehicle.delete({ where: { id: vehicle.id } });
  await writeAuditLog({
    userId: auth.session.user.id,
    action: "vehicle.deleted",
    recordType: "Vehicle",
    recordId: vehicle.id,
    before: { registration: vehicle.registration },
  });
  return NextResponse.json({ deleted: true, deactivated: false, message: "Vehicle deleted." });
}
