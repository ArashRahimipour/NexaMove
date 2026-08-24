import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const generateSchema = z.object({
  driverProfileId: z.string().min(1),
  periodStart: z.string(),
  periodEnd: z.string(),
});

export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const settlements = await prisma.settlement.findMany({
    include: { driver: { include: { user: true } } },
    orderBy: { periodStart: "desc" },
    take: 50,
  });
  return NextResponse.json({ settlements });
}

// Generate a settlement by summing actual per-delivery driverPayment/totalCharge
// for deliveries completed by this driver in the period — never a flat assumed rate.
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { driverProfileId, periodStart, periodEnd } = parsed.data;

  const driverProfile = await prisma.driver.findUnique({ where: { id: driverProfileId } });
  if (!driverProfile) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const deliveries = await prisma.delivery.findMany({
    where: {
      route: { driverId: driverProfile.userId },
      status: { in: ["DELIVERED", "PARTIALLY_DELIVERED"] },
      deliveredAt: { gte: start, lte: end },
    },
  });

  const grossAmount = deliveries.reduce((s, d) => s + (d.totalCharge ?? 0), 0);
  const driverShare = deliveries.reduce(
    (s, d) => s + (d.driverPayment ?? (d.totalCharge ?? 0) * (driverProfile.paymentSplitPercent / 100)),
    0
  );
  const companyShare = grossAmount - driverShare;

  const settlement = await prisma.settlement.create({
    data: {
      driverId: driverProfileId,
      periodStart: start,
      periodEnd: end,
      grossAmount,
      driverShare,
      companyShare,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ settlement }, { status: 201 });
}
