import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const createVehicleSchema = z.object({
  registration: z.string().min(1),
  type: z.string().min(1),
  make: z.string().optional(),
  model: z.string().optional(),
  maxCbm: z.number().optional(),
  maxWeight: z.number().optional(),
  insuranceExpiry: z.string().optional(),
  registrationExpiry: z.string().optional(),
});

export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const vehicles = await prisma.vehicle.findMany({
    include: { drivers: { select: { id: true, user: { select: { name: true } } } } },
    orderBy: { registration: "asc" },
  });
  return NextResponse.json({ vehicles });
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createVehicleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const existing = await prisma.vehicle.findUnique({ where: { registration: data.registration.toUpperCase() } });
  if (existing) return NextResponse.json({ error: "A vehicle with that registration already exists" }, { status: 409 });

  const vehicle = await prisma.vehicle.create({
    data: {
      ...data,
      registration: data.registration.toUpperCase(),
      insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : undefined,
      registrationExpiry: data.registrationExpiry ? new Date(data.registrationExpiry) : undefined,
    },
  });

  return NextResponse.json({ vehicle }, { status: 201 });
}
