import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().optional(),
  postcodes: z.string().optional(),
  adjustmentModel: z.enum(["NONE", "FIXED_TABLE", "FIXED_SURCHARGE", "MULTIPLIER", "CLIENT_NEGOTIATED"]).optional(),
  fixedSurcharge: z.number().nullable().optional(),
  multiplier: z.number().nullable().optional(),
  minimumCharge: z.number().nullable().optional(),
  overrideRateCardId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.deliveryZone.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  const updated = await prisma.deliveryZone.update({
    where: { id: params.id },
    data: { ...parsed.data, needsConfirmation: false },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "delivery_zone.updated",
    recordType: "DeliveryZone",
    recordId: updated.id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ zone: updated });
}
