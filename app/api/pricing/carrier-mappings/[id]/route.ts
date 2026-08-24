import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({ serviceTypeId: z.string() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.carrierServiceCodeMapping.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Mapping not found" }, { status: 404 });

  const updated = await prisma.carrierServiceCodeMapping.update({
    where: { id: params.id },
    data: { serviceTypeId: parsed.data.serviceTypeId, confirmed: true },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "carrier_mapping.confirmed",
    recordType: "CarrierServiceCodeMapping",
    recordId: updated.id,
    after: { sourceCode: updated.sourceCode, serviceTypeId: updated.serviceTypeId },
  });

  return NextResponse.json({ mapping: updated });
}
