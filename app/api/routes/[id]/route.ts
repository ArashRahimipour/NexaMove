import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

// Hard-deletes a route only if no deliveries were ever attached to it;
// otherwise cancels it (keeps the record and its stops/history intact).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const route = await prisma.route.findUnique({ where: { id: params.id } });
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  if (route.status === "CANCELLED") {
    return NextResponse.json({ error: "This route is already cancelled." }, { status: 409 });
  }

  const deliveries = await prisma.delivery.count({ where: { routeId: route.id } });

  if (deliveries > 0) {
    await prisma.route.update({ where: { id: route.id }, data: { status: "CANCELLED" } });
    await writeAuditLog({
      userId: auth.session.user.id,
      action: "route.cancelled",
      recordType: "Route",
      recordId: route.id,
      before: { status: route.status },
      after: { status: "CANCELLED" },
    });
    return NextResponse.json({
      deleted: false,
      deactivated: true,
      message: "This route has deliveries attached, so it was cancelled instead of deleted.",
    });
  }

  await prisma.route.delete({ where: { id: route.id } });
  await writeAuditLog({
    userId: auth.session.user.id,
    action: "route.deleted",
    recordType: "Route",
    recordId: route.id,
    before: { name: route.name },
  });
  return NextResponse.json({ deleted: true, deactivated: false, message: "Route deleted." });
}
