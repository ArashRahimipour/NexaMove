import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

const createSchema = z.object({
  organisationId: z.string().optional(),
  state: z.string().optional(),
  rateCardId: z.string().optional(),
  percentage: z.number().min(0).max(100),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const fuelLevies = await prisma.fuelLevyRule.findMany({
    include: { organisation: { select: { companyName: true } }, rateCard: { select: { name: true } } },
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json({ fuelLevies });
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const rule = await prisma.fuelLevyRule.create({
    data: {
      organisationId: data.organisationId,
      state: data.state,
      rateCardId: data.rateCardId,
      percentage: data.percentage,
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
      createdById: auth.session.user.id,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "fuel_levy.created",
    recordType: "FuelLevyRule",
    recordId: rule.id,
    after: { percentage: rule.percentage, state: rule.state, organisationId: rule.organisationId },
  });

  return NextResponse.json({ fuelLevy: rule }, { status: 201 });
}
