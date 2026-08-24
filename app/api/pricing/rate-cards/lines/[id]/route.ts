import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({ price: z.number().min(0) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.rateCardLine.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Rate card line not found" }, { status: 404 });

  const updated = await prisma.rateCardLine.update({
    where: { id: params.id },
    data: { price: parsed.data.price, needsConfirmation: false },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "rate_card_line.updated",
    recordType: "RateCardLine",
    recordId: updated.id,
    before: { price: existing.price },
    after: { price: updated.price },
  });

  return NextResponse.json({ line: updated });
}
