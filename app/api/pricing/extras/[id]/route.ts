import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({ amount: z.number().min(0), taxable: z.boolean().optional() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.pricingExtra.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Pricing extra not found" }, { status: 404 });

  const updated = await prisma.pricingExtra.update({
    where: { id: params.id },
    data: { amount: parsed.data.amount, taxable: parsed.data.taxable, needsConfirmation: false },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "pricing_extra.updated",
    recordType: "PricingExtra",
    recordId: updated.id,
    before: { amount: existing.amount },
    after: { amount: updated.amount },
  });

  return NextResponse.json({ extra: updated });
}
