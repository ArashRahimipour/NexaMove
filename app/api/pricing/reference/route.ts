import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// Everything the calculator needs to populate its dropdowns in one call.
export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const [serviceTypes, zones, rateCards, organisations] = await Promise.all([
    prisma.serviceType.findMany({ where: { active: true }, orderBy: { label: "asc" } }),
    prisma.deliveryZone.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.rateCard.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.organisation.findMany({ where: { active: true }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
  ]);

  return NextResponse.json({ serviceTypes, zones, rateCards, organisations });
}
