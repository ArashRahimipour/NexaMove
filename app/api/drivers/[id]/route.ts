import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

// Hard-deletes a driver only if they have no delivery history anywhere in the
// system; otherwise deactivates the account (blocks login, hidden from
// dispatch) so past routes/settlements/photos/damage reports stay intact.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const driver = await prisma.user.findUnique({
    where: { id: params.id },
    include: { driverProfile: true },
  });
  if (!driver || driver.role !== "DRIVER") {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  // Sequential, not Promise.all: production connects through a pooler with
  // connection_limit=1, and firing many queries at once against it triggers
  // "prepared statement already exists" — see docs/DEPLOYMENT.md.
  const routes = await prisma.route.count({ where: { driverId: driver.id } });
  const settlements = driver.driverProfile
    ? await prisma.settlement.count({ where: { driverId: driver.driverProfile.id } })
    : 0;
  const pods = await prisma.proofOfDelivery.count({ where: { capturedById: driver.id } });
  const damage = await prisma.damageReport.count({ where: { reportedById: driver.id } });
  const failed = await prisma.failedDeliveryReport.count({ where: { reportedById: driver.id } });
  const photos = await prisma.deliveryPhoto.count({ where: { uploadedById: driver.id } });
  const events = await prisma.trackingEvent.count({ where: { actorId: driver.id } });
  const created = await prisma.delivery.count({ where: { createdById: driver.id } });

  const hasHistory = routes + settlements + pods + damage + failed + photos + events + created > 0;

  if (hasHistory) {
    await prisma.$transaction([
      ...(driver.driverProfile
        ? [prisma.driver.update({ where: { id: driver.driverProfile.id }, data: { active: false } })]
        : []),
      prisma.user.update({ where: { id: driver.id }, data: { active: false } }),
    ]);
    await writeAuditLog({
      userId: auth.session.user.id,
      action: "driver.deactivated",
      recordType: "User",
      recordId: driver.id,
      before: { active: true },
      after: { active: false },
    });
    return NextResponse.json({
      deleted: false,
      deactivated: true,
      message: "This driver has delivery history, so they were deactivated instead of deleted.",
    });
  }

  await prisma.$transaction([
    ...(driver.driverProfile ? [prisma.driver.delete({ where: { id: driver.driverProfile.id } })] : []),
    prisma.user.delete({ where: { id: driver.id } }),
  ]);
  await writeAuditLog({
    userId: auth.session.user.id,
    action: "driver.deleted",
    recordType: "User",
    recordId: driver.id,
    before: { name: driver.name, email: driver.email },
  });
  return NextResponse.json({ deleted: true, deactivated: false, message: "Driver deleted." });
}
