import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { saveUpload } from "@/lib/storage";
import { assertTransition } from "@/lib/status-workflow";
import { writeAuditLog } from "@/lib/audit";

const failSchema = z.object({
  reason: z.enum([
    "CUSTOMER_NOT_HOME", "CUSTOMER_REFUSED", "CANNOT_ACCESS_PROPERTY", "INCORRECT_ADDRESS",
    "CUSTOMER_REQUESTED_RESCHEDULE", "PRODUCT_DAMAGED", "PRODUCT_MISSING", "UNSAFE_ACCESS",
    "VEHICLE_ACCESS_RESTRICTION", "OUTSIDE_WINDOW", "OTHER",
  ]),
  notes: z.string().optional(),
  gpsLat: z.number(),
  gpsLng: z.number(),
  photoDataUrl: z.string().startsWith("data:image/").optional(),
});

const PHOTO_REQUIRED_REASONS = new Set(["CANNOT_ACCESS_PROPERTY", "UNSAFE_ACCESS", "INCORRECT_ADDRESS", "PRODUCT_DAMAGED"]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("DRIVER");
  if (!auth.ok) return auth.response;

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: { route: true },
  });
  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (delivery.route?.driverId !== auth.session.user.id) {
    return NextResponse.json({ error: "This delivery is not on your route" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = failSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (PHOTO_REQUIRED_REASONS.has(data.reason) && !data.photoDataUrl) {
    return NextResponse.json(
      { error: `A photo is required when reporting "${data.reason.replaceAll("_", " ").toLowerCase()}".` },
      { status: 400 }
    );
  }

  try {
    assertTransition(delivery.status, "FAILED");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid transition" }, { status: 409 });
  }

  const photo = data.photoDataUrl ? await saveUpload(data.photoDataUrl, "failed") : null;

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.failedDeliveryReport.create({
      data: {
        deliveryId: delivery.id,
        reason: data.reason,
        notes: data.notes,
        gpsLat: data.gpsLat,
        gpsLng: data.gpsLng,
        photoUrl: photo?.url,
        reportedById: auth.session.user.id,
      },
    });

    if (photo) {
      await tx.deliveryPhoto.create({
        data: {
          deliveryId: delivery.id,
          url: photo.url,
          category: "FAILED_DELIVERY_EVIDENCE",
          uploadedById: auth.session.user.id,
          gpsLat: data.gpsLat,
          gpsLng: data.gpsLng,
        },
      });
    }

    await tx.trackingEvent.create({
      data: {
        deliveryId: delivery.id,
        type: "FAILED",
        lat: data.gpsLat,
        lng: data.gpsLng,
        note: `${data.reason}: ${data.notes ?? ""}`.trim(),
        oldStatus: delivery.status,
        newStatus: "FAILED",
        actorId: auth.session.user.id,
      },
    });

    await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", failedAt: new Date() },
    });

    await tx.alert.create({
      data: {
        type: "FAILED_DELIVERY",
        message: `Delivery ${delivery.trackingCode.slice(0, 8)} failed: ${data.reason}`,
        deliveryId: delivery.id,
      },
    });

    return created;
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "delivery.failed",
    recordType: "Delivery",
    recordId: delivery.id,
    before: { status: delivery.status },
    after: { status: "FAILED", reason: data.reason },
  });

  return NextResponse.json({ report }, { status: 201 });
}
