import { prisma } from "@/lib/prisma";
import { DELIVERY_STATUS_LABEL } from "@/lib/status-workflow";

// Customer AI context is intentionally narrow: exactly one delivery, chosen
// server-side (from the tracking token on the public page, or from the
// specific delivery row on the retail client portal) — the model never
// sees or chooses the ID. There is no "list all deliveries" tool here.
export interface CustomerToolContext {
  deliveryId?: string;
}

export interface CustomerToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: CustomerToolContext) => Promise<unknown>;
}

// Only customer-safe fields — never driver personal data, internal notes,
// costs, payments, settlements, alerts, or audit history.
async function loadCustomerSafeDelivery(deliveryId: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      trackingEvents: { orderBy: { createdAt: "asc" }, select: { type: true, createdAt: true } },
      proofOfDelivery: { select: { receiverName: true, capturedAt: true, contactless: true } },
      damageReports: { select: { createdAt: true } },
    },
  });
  if (!delivery) return null;
  return {
    trackingCode: delivery.trackingCode,
    status: delivery.status,
    statusLabel: DELIVERY_STATUS_LABEL[delivery.status],
    suburb: delivery.suburb,
    postcode: delivery.postcode,
    windowStart: delivery.windowStart,
    windowEnd: delivery.windowEnd,
    deliveredAt: delivery.deliveredAt,
    routeStarted: delivery.trackingEvents.some((e) => e.type === "ROUTE_STARTED" || e.type === "EN_ROUTE"),
    driverNearby: delivery.trackingEvents.some((e) => e.type === "DRIVER_NEARBY"),
    receivedBy: delivery.proofOfDelivery?.receiverName ?? null,
    deliveredContactless: delivery.proofOfDelivery?.contactless ?? false,
    hasDamageReport: delivery.damageReports.length > 0,
    events: delivery.trackingEvents.map((e) => ({ type: e.type, at: e.createdAt })),
  };
}

export const CUSTOMER_TOOLS: CustomerToolDef[] = [
  {
    name: "get_delivery_status",
    description: "Get the current status and tracking timeline for the customer's delivery.",
    parameters: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      if (!ctx.deliveryId) return { found: false };
      const delivery = await loadCustomerSafeDelivery(ctx.deliveryId);
      return delivery ? { found: true, delivery } : { found: false };
    },
  },
  {
    name: "create_customer_service_case",
    description: "Open a customer service case for the customer's delivery (e.g. damage report, delay complaint, general query).",
    parameters: {
      type: "object",
      properties: { note: { type: "string", description: "Description of the issue, in the customer's own words" } },
      required: ["note"],
    },
    handler: async (args, ctx) => {
      if (!ctx.deliveryId) return { created: false, error: "No delivery in context" };
      const delivery = await prisma.delivery.findUnique({ where: { id: ctx.deliveryId }, select: { id: true, createdById: true } });
      if (!delivery) return { created: false, error: "Delivery not found" };
      const created = await prisma.customerServiceCase.create({
        data: {
          deliveryId: delivery.id,
          openedById: delivery.createdById,
          notes: { create: { authorId: delivery.createdById, note: `[Via AI assistant] ${String(args.note ?? "")}` } },
        },
      });
      return { created: true, caseId: created.id };
    },
  },
];
