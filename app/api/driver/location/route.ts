import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { shouldWriteLocation } from "@/lib/gpsTracking";

const schema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().optional(),
});

// The client already throttles calls to this route (see
// components/DriverLocationTracker.tsx), but the write decision is made
// again here, server-side, against the driver's actual last-written row —
// never trusting the client alone to decide whether a write is "worth it".
export async function POST(req: Request) {
  const auth = await requireRole("DRIVER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const now = new Date();
  const last = await prisma.driverLocation.findFirst({
    where: { driverId: auth.session.user.id },
    orderBy: { recordedAt: "desc" },
  });

  if (!shouldWriteLocation(last, { lat: parsed.data.lat, lng: parsed.data.lng, at: now })) {
    return NextResponse.json({ written: false });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const route = await prisma.route.findFirst({
    where: { driverId: auth.session.user.id, date: { gte: today, lt: tomorrow } },
    select: { id: true },
  });

  const location = await prisma.driverLocation.create({
    data: {
      driverId: auth.session.user.id,
      routeId: route?.id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      accuracy: parsed.data.accuracy,
      recordedAt: now,
    },
  });

  return NextResponse.json({ written: true, location });
}
