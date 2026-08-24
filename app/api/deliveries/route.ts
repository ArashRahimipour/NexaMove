import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const itemSchema = z.object({
  sku: z.string().optional(),
  productDescription: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  boxes: z.number().int().min(0).optional(),
  cbm: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  fragile: z.boolean().optional(),
  assemblyRequired: z.boolean().optional(),
});

const createDeliverySchema = z.object({
  routeId: z.string().optional(),
  externalReference: z.string().optional(),
  organisationId: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  address: z.string().min(1),
  suburb: z.string().min(1),
  postcode: z.string().min(4).max(4),
  state: z.string().optional(),
  region: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  deliveryDate: z.string().optional(),
  windowStart: z.string().optional(),
  windowEnd: z.string().optional(),
  assemblyRequired: z.boolean().optional(),
  packagingRemovalRequired: z.boolean().optional(),
  specialInstructions: z.string().optional(),
  items: z.array(itemSchema).optional(),
});

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export async function GET(req: Request) {
  const auth = await requireRole();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const routeId = searchParams.get("routeId");
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

  // Retail clients only ever see their own organisation's deliveries.
  const orgFilter =
    auth.session.user.role === "RETAIL_CLIENT"
      ? { organisationId: auth.session.user.organisationId ?? "__none__" }
      : {};

  // Unfiltered, unpaginated `findMany` here used to return the entire table
  // (with proofOfDelivery + items joined onto every row) on every call — the
  // list now defaults to 50 rows/request and hard-caps at 100, with a total
  // count returned separately so callers can page through the rest.
  const where = {
    ...(routeId ? { routeId } : {}),
    ...(status ? { status: status as never } : {}),
    ...orgFilter,
  };

  // A single route's stop list is a naturally bounded, small set (a driver's
  // day) — paginating it would risk truncating a real route. Only the
  // unbounded "every delivery" query needs paging.
  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: { proofOfDelivery: true, items: true },
      orderBy: { sequence: "asc" },
      ...(routeId ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
    }),
    prisma.delivery.count({ where }),
  ]);

  return NextResponse.json({
    deliveries,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "RETAIL_CLIENT");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, ...data } = parsed.data;

  // A retail client can only ever create deliveries under their own organisation.
  const organisationId =
    auth.session.user.role === "RETAIL_CLIENT" ? auth.session.user.organisationId ?? undefined : data.organisationId;

  const count = data.routeId ? await prisma.delivery.count({ where: { routeId: data.routeId } }) : 0;
  const hasRoute = Boolean(data.routeId);

  const delivery = await prisma.delivery.create({
    data: {
      ...data,
      customerEmail: data.customerEmail || undefined,
      organisationId,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
      windowStart: data.windowStart ? new Date(data.windowStart) : undefined,
      windowEnd: data.windowEnd ? new Date(data.windowEnd) : undefined,
      sequence: count,
      status: hasRoute ? "ASSIGNED" : "PENDING",
      dispatchedAt: hasRoute ? new Date() : undefined,
      createdById: auth.session.user.id,
      items: items && items.length > 0 ? { create: items } : undefined,
    },
    include: { items: true },
  });

  await prisma.trackingEvent.create({
    data: {
      deliveryId: delivery.id,
      type: hasRoute ? "DRIVER_ASSIGNED" : "JOB_CREATED",
      oldStatus: hasRoute ? "PENDING" : undefined,
      newStatus: delivery.status,
      actorId: auth.session.user.id,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "delivery.created",
    recordType: "Delivery",
    recordId: delivery.id,
    after: { customerName: delivery.customerName, routeId: delivery.routeId },
  });

  return NextResponse.json({ delivery }, { status: 201 });
}
