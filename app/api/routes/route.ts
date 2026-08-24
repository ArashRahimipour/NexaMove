import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const createRouteSchema = z.object({
  name: z.string().min(1),
  date: z.string(),
  driverId: z.string().optional(),
  region: z.string().optional(),
});

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  const routes = await prisma.route.findMany({
    where: date ? { date: new Date(date) } : undefined,
    include: {
      driver: { select: { id: true, name: true } },
      deliveries: {
        select: { id: true, status: true, customerName: true, suburb: true, sequence: true },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ routes });
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, date, driverId, region } = parsed.data;

  const route = await prisma.route.create({
    data: {
      name,
      date: new Date(date),
      driverId: driverId || undefined,
      region: region || "QLD",
      createdById: auth.session.user.id,
      status: driverId ? "IN_PROGRESS" : "PLANNED",
    },
  });

  return NextResponse.json({ route }, { status: 201 });
}
