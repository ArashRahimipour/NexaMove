import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { assertTransition } from "@/lib/status-workflow";
import { writeAuditLog } from "@/lib/audit";
import { checkGeofence } from "@/lib/geofence";
import type { DeliveryStatus, TrackingEventType } from "@prisma/client";

const eventSchema = z.object({
  type: z.enum(["ROUTE_STARTED", "EN_ROUTE", "DRIVER_NEARBY", "ARRIVED", "FAILED"]),
  lat: z.number(),
  lng: z.number(),
  note: z.string().optional(),
  geofenceOverrideReason: z.string().optional(),
});

const STATUS_FOR_EVENT: Record<string, DeliveryStatus> = {
  ROUTE_STARTED: "IN_TRANSIT",
  EN_ROUTE: "IN_TRANSIT",
  DRIVER_NEARBY: "DRIVER_NEARBY",
  ARRIVED: "ARRIVED",
  FAILED: "FAILED",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("DRIVER", "ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: { route: true },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  if (auth.session.user.role === "DRIVER" && delivery.route?.driverId !== auth.session.user.id) {
    return NextResponse.json({ error: "This delivery is not on your route" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, lat, lng, note, geofenceOverrideReason } = parsed.data;
  const newStatus = STATUS_FOR_EVENT[type];

  try {
    assertTransition(delivery.status, newStatus);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid status transition" },
      { status: 409 }
    );
  }

  let geofenceNote = note;
  if (type === "ARRIVED") {
    const { verified, distanceM } = checkGeofence(lat, lng, delivery.lat, delivery.lng);
    if (verified === false && !geofenceOverrideReason) {
      return NextResponse.json(
        {
          error: "geofence_warning",
          message: `You appear to be ~${Math.round(distanceM ?? 0)}m from the delivery address. Confirm you are at the correct location or provide a reason to continue.`,
          distanceM,
        },
        { status: 422 }
      );
    }
    if (verified === false && geofenceOverrideReason) {
      geofenceNote = `Geofence override: ${geofenceOverrideReason}`;
    }
  }

  const [event] = await prisma.$transaction([
    prisma.trackingEvent.create({
      data: {
        deliveryId: delivery.id,
        type: type as TrackingEventType,
        lat,
        lng,
        note: geofenceNote,
        oldStatus: delivery.status,
        newStatus,
        actorId: auth.session.user.id,
      },
    }),
    prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status: newStatus,
        arrivedAt: type === "ARRIVED" ? new Date() : undefined,
        failedAt: type === "FAILED" ? new Date() : undefined,
      },
    }),
  ]);

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "delivery.status_changed",
    recordType: "Delivery",
    recordId: delivery.id,
    before: { status: delivery.status },
    after: { status: newStatus },
  });

  return NextResponse.json({ event }, { status: 201 });
}
