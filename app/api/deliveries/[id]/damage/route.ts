import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { saveUpload } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";

const damageSchema = z.object({
  discoveredStage: z.enum([
    "BEFORE_LOADING", "DURING_LOADING", "IN_VEHICLE", "DURING_TRANSPORT",
    "DURING_UNLOADING", "DURING_ASSEMBLY", "AT_CUSTOMER_PROPERTY", "CUSTOMER_REPORTED", "UNKNOWN",
  ]),
  reason: z.enum([
    "PRODUCT_ALREADY_DAMAGED", "WAREHOUSE_HANDLING", "INCORRECT_LOADING", "INSUFFICIENT_PROTECTION",
    "PRODUCT_MOVEMENT", "DRIVER_HANDLING", "OFFSIDER_HANDLING", "CUSTOMER_ACCESS_ISSUE", "STAIRS",
    "LIFT_RESTRICTION", "ASSEMBLY_DAMAGE", "PACKAGING_FAILURE", "MANUFACTURING_DEFECT", "UNKNOWN", "OTHER",
  ]),
  description: z.string().min(1),
  itemId: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  photos: z.array(z.string().startsWith("data:image/")).min(1),
});

// Driver-submitted damage report. Responsibility always starts UNDETERMINED —
// only Operations/Admin can assign blame, via PATCH below, and that change is audited.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("DRIVER", "ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: { route: true },
  });
  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

  if (auth.session.user.role === "DRIVER" && delivery.route?.driverId !== auth.session.user.id) {
    return NextResponse.json({ error: "This delivery is not on your route" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = damageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const uploaded = await Promise.all(data.photos.map((p) => saveUpload(p, "damage")));

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.damageReport.create({
      data: {
        deliveryId: delivery.id,
        itemId: data.itemId,
        discoveredStage: data.discoveredStage,
        reason: data.reason,
        description: data.description,
        reportedById: auth.session.user.id,
        gpsLat: data.gpsLat,
        gpsLng: data.gpsLng,
      },
    });

    for (const photo of uploaded) {
      await tx.deliveryPhoto.create({
        data: {
          deliveryId: delivery.id,
          url: photo.url,
          category: "DAMAGE_CLOSEUP",
          uploadedById: auth.session.user.id,
          gpsLat: data.gpsLat,
          gpsLng: data.gpsLng,
        },
      });
    }

    await tx.trackingEvent.create({
      data: {
        deliveryId: delivery.id,
        type: "DAMAGE_NOTED",
        lat: data.gpsLat,
        lng: data.gpsLng,
        note: data.description,
        actorId: auth.session.user.id,
      },
    });

    await tx.alert.create({
      data: {
        type: "DAMAGE_REPORT",
        message: `Damage reported on delivery ${delivery.trackingCode.slice(0, 8)}`,
        deliveryId: delivery.id,
      },
    });

    return created;
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "damage.reported",
    recordType: "DamageReport",
    recordId: report.id,
    after: { deliveryId: delivery.id, reason: data.reason, stage: data.discoveredStage },
  });

  return NextResponse.json({ report }, { status: 201 });
}

const responsibilitySchema = z.object({
  damageReportId: z.string().min(1),
  responsibility: z.enum([
    "UNDETERMINED", "WAREHOUSE", "SUPPLIER", "MANUFACTURING", "DRIVER", "OFFSIDER",
    "TRANSPORT", "CUSTOMER", "PACKAGING", "OTHER", "NO_RESPONSIBILITY",
  ]),
});

// Operations/Admin only: assign responsibility for an existing damage report.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = responsibilitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.damageReport.findUnique({ where: { id: parsed.data.damageReportId } });
  if (!existing || existing.deliveryId !== params.id) {
    return NextResponse.json({ error: "Damage report not found" }, { status: 404 });
  }

  const updated = await prisma.damageReport.update({
    where: { id: parsed.data.damageReportId },
    data: {
      responsibility: parsed.data.responsibility,
      responsibilitySetById: auth.session.user.id,
      responsibilitySetAt: new Date(),
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "damage.responsibility_set",
    recordType: "DamageReport",
    recordId: updated.id,
    before: { responsibility: existing.responsibility },
    after: { responsibility: updated.responsibility },
  });

  return NextResponse.json({ report: updated });
}
