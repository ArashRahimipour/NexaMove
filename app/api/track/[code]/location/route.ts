import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLocationFresh } from "@/lib/gpsTracking";
import { estimateEtaWindow } from "@/lib/eta";

const ACTIVE_STATUSES = ["ROUTE_STARTED", "IN_TRANSIT", "DRIVER_NEARBY"];

// Public — gated by the tracking code itself (the "safe public token" this
// app already uses for tracking), and further scoped so a driver's
// location is only ever exposed while that specific delivery is actively
// en route, never at any other time, and never any other delivery's
// driver. Only load required public tracking data (Part B.2/H): lat/lng
// of the driver and the ETA window, nothing else about the delivery,
// driver, or route.
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode: params.code },
    select: {
      status: true,
      lat: true,
      lng: true,
      sequence: true,
      routeId: true,
      route: { select: { driverId: true } },
    },
  });

  if (!delivery || !ACTIVE_STATUSES.includes(delivery.status) || !delivery.route?.driverId) {
    return NextResponse.json({ available: false });
  }

  const location = await prisma.driverLocation.findFirst({
    where: { driverId: delivery.route.driverId },
    orderBy: { recordedAt: "desc" },
  });

  if (!location || !isLocationFresh(location.recordedAt)) {
    return NextResponse.json({ available: false });
  }

  let eta = null;
  if (delivery.lat != null && delivery.lng != null) {
    const stopsAhead = await prisma.delivery.count({
      where: {
        routeId: delivery.routeId,
        sequence: { lt: delivery.sequence },
        status: { notIn: ["DELIVERED", "PARTIALLY_DELIVERED", "FAILED", "CANCELLED", "RETURNED"] },
      },
    });
    eta = estimateEtaWindow({
      driverLat: location.lat,
      driverLng: location.lng,
      destLat: delivery.lat,
      destLng: delivery.lng,
      stopsAhead,
    });
  }

  return NextResponse.json({
    available: true,
    driverLat: location.lat,
    driverLng: location.lng,
    destLat: delivery.lat,
    destLng: delivery.lng,
    etaEarliest: eta?.earliest ?? null,
    etaLatest: eta?.latest ?? null,
  });
}
