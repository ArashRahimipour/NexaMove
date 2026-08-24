import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const assignSchema = z.object({
  deliveryId: z.string().min(1),
  driverId: z.string().min(1),
  overrideCapacity: z.boolean().optional(),
});

// Assigns an unassigned delivery to a driver, creating (or reusing) that
// driver's route for today, after checking vehicle CBM/weight capacity.
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { deliveryId, driverId, overrideCapacity } = parsed.data;

  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

  const driver = await prisma.user.findUnique({ where: { id: driverId }, include: { driverProfile: { include: { vehicle: true } } } });
  if (!driver || driver.role !== "DRIVER") return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let route = await prisma.route.findFirst({
    where: { driverId, date: { gte: today, lt: tomorrow } },
    include: { deliveries: true },
  });

  const vehicle = driver.driverProfile?.vehicle;
  if (vehicle && (vehicle.maxCbm || vehicle.maxWeight) && !overrideCapacity) {
    const existingCbm = route?.deliveries.reduce((sum, d) => sum + (d.cbm ?? 0), 0) ?? 0;
    const existingWeight = route?.deliveries.reduce((sum, d) => sum + (d.weight ?? 0), 0) ?? 0;
    const newCbm = existingCbm + (delivery.cbm ?? 0);
    const newWeight = existingWeight + (delivery.weight ?? 0);
    if ((vehicle.maxCbm && newCbm > vehicle.maxCbm) || (vehicle.maxWeight && newWeight > vehicle.maxWeight)) {
      return NextResponse.json(
        {
          error: "capacity_exceeded",
          message: `Assigning this delivery would exceed ${vehicle.registration}'s capacity (${newCbm.toFixed(1)}/${vehicle.maxCbm ?? "∞"} m³, ${newWeight}/${vehicle.maxWeight ?? "∞"} kg).`,
        },
        { status: 409 }
      );
    }
  }

  if (!route) {
    route = await prisma.route.create({
      data: {
        name: `${driver.name} — ${today.toLocaleDateString("en-AU")}`,
        date: today,
        driverId,
        vehicleId: vehicle?.id,
        status: "IN_PROGRESS",
        createdById: auth.session.user.id,
      },
      include: { deliveries: true },
    });
  }

  const sequence = route.deliveries.length;

  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.delivery.update({
      where: { id: deliveryId },
      data: { routeId: route!.id, sequence, status: "ASSIGNED", dispatchedAt: new Date() },
    });
    await tx.trackingEvent.create({
      data: { deliveryId, type: "DRIVER_ASSIGNED", oldStatus: delivery.status, newStatus: "ASSIGNED", actorId: auth.session.user.id },
    });
    return d;
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "delivery.dispatched",
    recordType: "Delivery",
    recordId: deliveryId,
    after: { driverId, routeId: route.id },
  });

  return NextResponse.json({ delivery: updated });
}
