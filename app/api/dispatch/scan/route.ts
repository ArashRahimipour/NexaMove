import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { assertTransition } from "@/lib/status-workflow";
import { writeAuditLog } from "@/lib/audit";
import type { DispatchScanOutcome } from "@prisma/client";

// Warehouse dispatch scan: the ONLY way a delivery reaches LOADED. Assigning
// a delivery to a route (app/api/dispatch/assign) never implies it was
// physically collected — that distinction is the entire point of this
// endpoint. Every scan attempt (success or rejected) is written to
// DispatchScan, and a DB-level partial unique index (see the migration)
// guarantees only one successful scan can ever exist per delivery even
// under a race — this endpoint's own DUPLICATE_SCAN check is the friendly,
// fast-path version of that guarantee, not a replacement for it.
const scanSchema = z.object({
  code: z.string().min(1),
  // Required for non-driver callers (warehouse/ops staff scanning on
  // someone's behalf); a DRIVER caller always scans against their own
  // route for today, so it's derived server-side instead.
  routeId: z.string().optional(),
  warehouse: z.string().optional(),
  device: z.string().optional(),
});

const REJECTION_MESSAGES: Record<Exclude<DispatchScanOutcome, "SCANNED">, string> = {
  NOT_FOUND: "No delivery matches this code.",
  CANCELLED_ORDER: "This order has been cancelled — it should not be loaded.",
  MISSING_FROM_ROUTE: "This delivery is not assigned to any route yet.",
  WRONG_ROUTE: "This delivery is assigned to a different route.",
  DUPLICATE_SCAN: "This delivery has already been scanned.",
  ALREADY_DISPATCHED: "This delivery has already moved past collection.",
};

export async function POST(req: Request) {
  const auth = await requireRole("DRIVER", "ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = scanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { code, warehouse, device } = parsed.data;
  let routeId = parsed.data.routeId;

  if (auth.session.user.role === "DRIVER") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const route = await prisma.route.findFirst({
      where: { driverId: auth.session.user.id, date: { gte: today, lt: tomorrow } },
    });
    if (!route) return NextResponse.json({ error: "You have no route assigned for today." }, { status: 404 });
    routeId = route.id;
  }
  if (!routeId) return NextResponse.json({ error: "routeId is required." }, { status: 400 });

  const reject = async (outcome: Exclude<DispatchScanOutcome, "SCANNED">, deliveryId: string | null, extra?: object) => {
    await prisma.dispatchScan.create({
      data: { scannedCode: code, deliveryId, routeId, scannedById: auth.session.user.id, warehouse, device, outcome },
    });
    return NextResponse.json({ outcome, error: REJECTION_MESSAGES[outcome], ...extra }, { status: 409 });
  };

  // Matched against either the internal tracking code or an imported
  // external/consignment reference (e.g. a Koala order number) — whichever
  // the driver's scanner actually reads.
  const delivery = await prisma.delivery.findFirst({
    where: { OR: [{ trackingCode: code }, { externalReference: code }] },
  });
  if (!delivery) return reject("NOT_FOUND", null);

  if (delivery.status === "CANCELLED") return reject("CANCELLED_ORDER", delivery.id, { delivery });
  if (!delivery.routeId) return reject("MISSING_FROM_ROUTE", delivery.id, { delivery });
  if (delivery.routeId !== routeId) return reject("WRONG_ROUTE", delivery.id, { delivery });

  const priorSuccess = await prisma.dispatchScan.findFirst({ where: { deliveryId: delivery.id, outcome: "SCANNED" } });
  if (priorSuccess) return reject("DUPLICATE_SCAN", delivery.id, { delivery });

  try {
    assertTransition(delivery.status, "LOADED");
  } catch {
    // Reached this delivery's current status through some path other than
    // a fresh scan (e.g. skipped straight to in-transit) — a scan can no
    // longer be the thing that confirms collection for it.
    return reject("ALREADY_DISPATCHED", delivery.id, { delivery });
  }

  const [scan, updated] = await prisma.$transaction([
    prisma.dispatchScan.create({
      data: { scannedCode: code, deliveryId: delivery.id, routeId, scannedById: auth.session.user.id, warehouse, device, outcome: "SCANNED" },
    }),
    prisma.delivery.update({ where: { id: delivery.id }, data: { status: "LOADED" } }),
    prisma.trackingEvent.create({
      data: {
        deliveryId: delivery.id,
        type: "LOADED",
        oldStatus: delivery.status,
        newStatus: "LOADED",
        actorId: auth.session.user.id,
        note: warehouse ? `Dispatch scan at ${warehouse}` : "Dispatch scan",
      },
    }),
  ]);

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "dispatch_scan.scanned",
    recordType: "Delivery",
    recordId: delivery.id,
    before: { status: delivery.status },
    after: { status: "LOADED", scanId: scan.id },
  });

  return NextResponse.json({ outcome: "SCANNED", delivery: updated, scan });
}
