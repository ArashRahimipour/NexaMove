import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const createSchema = z.object({
  status: z.enum(["NOT_CONTACTED", "CONTACT_ATTEMPTED", "CONFIRMED", "UNABLE_TO_CONTACT", "DETAILS_CHANGED"]),
  channel: z.enum(["PHONE", "SMS", "EMAIL", "IN_PERSON", "OTHER"]),
  notes: z.string().optional(),
  customerResponse: z.string().optional(),
});

// Every contact attempt is its own row — never a single mutable flag on the
// delivery — so the full history (who, when, how, what the customer said)
// stays a real, auditable record. See prisma/schema.prisma's
// PreDeliveryConfirmation comment.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const delivery = await prisma.delivery.findUnique({ where: { id: params.id } });
  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const confirmation = await prisma.preDeliveryConfirmation.create({
    data: {
      deliveryId: delivery.id,
      staffId: auth.session.user.id,
      ...parsed.data,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "pre_delivery_confirmation.logged",
    recordType: "Delivery",
    recordId: delivery.id,
    after: { status: confirmation.status, channel: confirmation.channel },
  });

  return NextResponse.json({ confirmation }, { status: 201 });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const confirmations = await prisma.preDeliveryConfirmation.findMany({
    where: { deliveryId: params.id },
    include: { staff: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ confirmations });
}
