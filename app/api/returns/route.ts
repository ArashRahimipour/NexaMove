import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { computeReturnSlaDeadline } from "@/lib/returns";

const itemSchema = z.object({
  description: z.string().min(1),
  sku: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
});

const createSchema = z.object({
  deliveryId: z.string().min(1),
  warehouse: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).optional(),
  // true = the driver has the goods in hand right now (the common case when
  // this is logged from the field) — starts the 48h SLA clock immediately.
  // Left false for an ops-initiated record ahead of an actual collection.
  collected: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireRole("DRIVER", "ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { deliveryId, warehouse, notes, items, collected } = parsed.data;

  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { route: true } });
  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

  if (auth.session.user.role === "DRIVER" && delivery.route?.driverId !== auth.session.user.id) {
    return NextResponse.json({ error: "This delivery is not on your route" }, { status: 403 });
  }

  const driverId = auth.session.user.role === "DRIVER" ? auth.session.user.id : (delivery.route?.driverId ?? null);
  const now = new Date();

  const returnTask = await prisma.returnTask.create({
    data: {
      deliveryId,
      driverId,
      warehouse,
      notes,
      status: collected ? "DRIVER_POSSESSION" : "CUSTOMER_COLLECTION",
      collectedAt: collected ? now : undefined,
      slaDeadline: collected ? computeReturnSlaDeadline(now) : undefined,
      createdById: auth.session.user.id,
      items: items && items.length > 0 ? { create: items } : undefined,
    },
    include: { items: true },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "return_task.created",
    recordType: "ReturnTask",
    recordId: returnTask.id,
    after: { deliveryId, status: returnTask.status },
  });

  return NextResponse.json({ returnTask }, { status: 201 });
}

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const includeClosed = searchParams.get("includeClosed") === "true";

  const returnTasks = await prisma.returnTask.findMany({
    where: includeClosed ? {} : { status: { not: "CLOSED" } },
    include: {
      delivery: { select: { id: true, customerName: true, trackingCode: true, externalReference: true, organisationId: true } },
      driver: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: [{ slaDeadline: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ returnTasks });
}
