import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const rateCards = await prisma.rateCard.findMany({
    include: {
      organisation: { select: { companyName: true } },
      lines: { include: { serviceType: true, cbmBand: true }, orderBy: [{ serviceType: { label: "asc" } }, { cbmBand: { sortOrder: "asc" } }] },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ rateCards });
}
