import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const mappings = await prisma.carrierServiceCodeMapping.findMany({
    include: { serviceType: true },
    orderBy: { sourceCode: "asc" },
  });
  return NextResponse.json({ mappings });
}
