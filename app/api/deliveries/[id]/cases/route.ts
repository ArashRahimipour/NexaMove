import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const noteSchema = z.object({ note: z.string().min(1) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const delivery = await prisma.delivery.findUnique({ where: { id: params.id } });
  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const initialNote = noteSchema.safeParse(body);

  const created = await prisma.customerServiceCase.create({
    data: {
      deliveryId: delivery.id,
      openedById: auth.session.user.id,
      notes: initialNote.success ? { create: { authorId: auth.session.user.id, note: initialNote.data.note } } : undefined,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "case.opened",
    recordType: "CustomerServiceCase",
    recordId: created.id,
    after: { deliveryId: delivery.id },
  });

  return NextResponse.json({ case: created }, { status: 201 });
}
