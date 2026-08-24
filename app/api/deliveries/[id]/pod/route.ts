import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { saveUpload } from "@/lib/storage";
import { checkGeofence } from "@/lib/geofence";
import { assertTransition } from "@/lib/status-workflow";
import { writeAuditLog } from "@/lib/audit";

const photoSchema = z.object({
  dataUrl: z.string().startsWith("data:image/"),
  category: z.enum([
    "PRODUCT_DELIVERED", "PRODUCT_IN_FINAL_LOCATION", "ASSEMBLY_COMPLETED",
    "PACKAGING_REMOVED", "CUSTOMER_PROPERTY_ACCESS", "OTHER",
  ]),
});

const itemResultSchema = z.object({
  itemId: z.string(),
  status: z.enum(["DELIVERED", "NOT_DELIVERED", "DAMAGED", "MISSING", "REFUSED"]),
});

const podSchema = z.object({
  photos: z.array(photoSchema).min(1),
  signatureDataUrl: z.string().startsWith("data:image/").optional(),
  receiverName: z.string().optional(),
  receiverRelationship: z.enum(["CUSTOMER", "FAMILY_MEMBER", "STAFF", "RECEPTION", "OTHER"]).optional(),
  signatureExceptionReason: z.string().optional(),
  contactless: z.boolean(),
  assemblyCompleted: z.boolean(),
  packagingRemoved: z.boolean(),
  gpsLat: z.number(),
  gpsLng: z.number(),
  gpsAccuracyM: z.number().optional(),
  geofenceOverrideReason: z.string().optional(),
  itemResults: z.array(itemResultSchema).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("DRIVER");
  if (!auth.ok) return auth.response;

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: { route: true, proofOfDelivery: true, items: true },
  });
  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (delivery.route?.driverId !== auth.session.user.id) {
    return NextResponse.json({ error: "This delivery is not on your route" }, { status: 403 });
  }
  if (delivery.proofOfDelivery) {
    return NextResponse.json({ error: "Proof of delivery already captured" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = podSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (!data.contactless && !data.signatureDataUrl && !data.signatureExceptionReason) {
    return NextResponse.json(
      { error: "Capture a signature, mark contactless, or record why the customer couldn't sign." },
      { status: 400 }
    );
  }
  if (!data.contactless && !data.signatureExceptionReason && !data.receiverName) {
    return NextResponse.json({ error: "Receiver name is required." }, { status: 400 });
  }

  const { verified, distanceM } = checkGeofence(data.gpsLat, data.gpsLng, delivery.lat, delivery.lng);
  if (verified === false && !data.geofenceOverrideReason) {
    return NextResponse.json(
      {
        error: "geofence_warning",
        message: `You appear to be ~${Math.round(distanceM ?? 0)}m from the delivery address. Confirm the location or provide a reason to continue.`,
        distanceM,
      },
      { status: 422 }
    );
  }

  // Determine overall outcome from per-item results if this delivery has line items.
  let finalStatus: "DELIVERED" | "PARTIALLY_DELIVERED" = "DELIVERED";
  if (delivery.items.length > 0 && data.itemResults) {
    const anyIssue = data.itemResults.some((r) => r.status !== "DELIVERED");
    finalStatus = anyIssue ? "PARTIALLY_DELIVERED" : "DELIVERED";
  }

  try {
    assertTransition(delivery.status, finalStatus);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid transition" }, { status: 409 });
  }

  const [uploadedPhotos, signature] = await Promise.all([
    Promise.all(data.photos.map(async (p) => ({ ...(await saveUpload(p.dataUrl, "photos")), category: p.category }))),
    data.signatureDataUrl ? saveUpload(data.signatureDataUrl, "signatures") : Promise.resolve(null),
  ]);

  const pod = await prisma.$transaction(async (tx) => {
    const created = await tx.proofOfDelivery.create({
      data: {
        deliveryId: delivery.id,
        signatureUrl: signature?.url,
        receiverName: data.receiverName,
        receiverRelationship: data.receiverRelationship,
        signatureExceptionReason: data.signatureExceptionReason,
        contactless: data.contactless,
        assemblyCompleted: data.assemblyCompleted,
        packagingRemoved: data.packagingRemoved,
        gpsLat: data.gpsLat,
        gpsLng: data.gpsLng,
        gpsAccuracyM: data.gpsAccuracyM,
        geofenceVerified: verified,
        geofenceOverrideReason: data.geofenceOverrideReason,
        capturedById: auth.session.user.id,
      },
    });

    for (const photo of uploadedPhotos) {
      await tx.deliveryPhoto.create({
        data: {
          deliveryId: delivery.id,
          url: photo.url,
          category: photo.category,
          uploadedById: auth.session.user.id,
          gpsLat: data.gpsLat,
          gpsLng: data.gpsLng,
        },
      });
    }

    if (data.itemResults) {
      for (const result of data.itemResults) {
        await tx.deliveryItem.update({ where: { id: result.itemId }, data: { itemStatus: result.status } });
      }
    }

    const events: { type: "PHOTO_CAPTURED" | "SIGNATURE_CAPTURED" | "DELIVERED" | "PARTIALLY_DELIVERED" }[] = [
      { type: "PHOTO_CAPTURED" },
    ];
    if (signature) events.push({ type: "SIGNATURE_CAPTURED" });
    events.push({ type: finalStatus === "DELIVERED" ? "DELIVERED" : "PARTIALLY_DELIVERED" });

    for (const e of events) {
      await tx.trackingEvent.create({
        data: {
          deliveryId: delivery.id,
          type: e.type,
          lat: data.gpsLat,
          lng: data.gpsLng,
          oldStatus: e.type === events[events.length - 1].type ? delivery.status : undefined,
          newStatus: e.type === events[events.length - 1].type ? finalStatus : undefined,
          actorId: auth.session.user.id,
        },
      });
    }

    await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: finalStatus, deliveredAt: new Date() },
    });

    return created;
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "delivery.completed",
    recordType: "Delivery",
    recordId: delivery.id,
    before: { status: delivery.status },
    after: { status: finalStatus },
  });

  return NextResponse.json({ pod, finalStatus }, { status: 201 });
}
