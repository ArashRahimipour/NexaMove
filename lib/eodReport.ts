import { prisma } from "@/lib/prisma";

// End-of-day run report — shared between the ops-facing admin report
// (any client, any route) and the retail client portal's scoped version
// (their own organisation's deliveries only) so the two never drift.
//
// Note on scope: Koala's brief distinguishes "exchanges" / "collections" /
// "returns" as separate line items, but nothing in this schema tracks a
// delivery's TYPE (standard delivery vs. exchange vs. straight collection)
// — only that a ReturnTask exists against it once goods are actually being
// taken back. This report reports return-task counts (outstanding vs.
// closed), not a three-way exchange/collection/return split, since that
// split isn't data this app captures yet. "Futile delivery" is similarly
// not its own status — CANCELLED is the closest existing concept and is
// reported as that, not relabelled as "futile" without a real distinction
// in the data.
export interface EodFilters {
  from: Date;
  to: Date;
  routeId?: string;
  driverId?: string;
  vehicleId?: string;
  organisationId?: string;
}

export async function computeEodReport(filters: EodFilters) {
  const where = {
    ...(filters.organisationId ? { organisationId: filters.organisationId } : {}),
    route: {
      date: { gte: filters.from, lte: filters.to },
      ...(filters.routeId ? { id: filters.routeId } : {}),
      ...(filters.driverId ? { driverId: filters.driverId } : {}),
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    },
  };

  const deliveries = await prisma.delivery.findMany({
    where,
    include: {
      route: { include: { driver: { select: { name: true } }, vehicle: { select: { registration: true } } } },
      proofOfDelivery: { select: { id: true } },
      damageReports: { select: { id: true } },
      failedDeliveryReports: { select: { id: true } },
      customerServiceCases: { select: { id: true } },
      returnTasks: { select: { id: true, status: true } },
    },
    orderBy: [{ route: { date: "desc" } }, { sequence: "asc" }],
  });

  const FINISHED = new Set(["DELIVERED", "PARTIALLY_DELIVERED", "FAILED", "CANCELLED", "RETURNED"]);

  const summary = {
    totalJobs: deliveries.length,
    delivered: deliveries.filter((d) => d.status === "DELIVERED").length,
    partiallyDelivered: deliveries.filter((d) => d.status === "PARTIALLY_DELIVERED").length,
    failed: deliveries.filter((d) => d.status === "FAILED").length,
    cancelled: deliveries.filter((d) => d.status === "CANCELLED").length,
    damaged: deliveries.filter((d) => d.damageReports.length > 0).length,
    outstanding: deliveries.filter((d) => !FINISHED.has(d.status)).length,
    missingPod: deliveries.filter((d) => FINISHED.has(d.status) && d.status !== "FAILED" && d.status !== "CANCELLED" && !d.proofOfDelivery).length,
    customerIssues: deliveries.reduce((sum, d) => sum + d.customerServiceCases.length, 0),
    lateDeliveries: deliveries.filter((d) => d.deliveredAt && d.windowEnd && d.deliveredAt > d.windowEnd).length,
    driverIncidents: deliveries.reduce((sum, d) => sum + d.damageReports.length + d.failedDeliveryReports.length, 0),
    returnTasksTotal: deliveries.reduce((sum, d) => sum + d.returnTasks.length, 0),
    returnTasksOutstanding: deliveries.reduce((sum, d) => sum + d.returnTasks.filter((r) => r.status !== "CLOSED").length, 0),
  };

  const rows = deliveries.map((d) => ({
    id: d.id,
    customerName: d.customerName,
    trackingCode: d.trackingCode,
    externalReference: d.externalReference,
    routeName: d.route?.name ?? null,
    driverName: d.route?.driver?.name ?? null,
    vehicleRegistration: d.route?.vehicle?.registration ?? null,
    status: d.status,
    arrivedAt: d.arrivedAt,
    deliveredAt: d.deliveredAt,
    late: Boolean(d.deliveredAt && d.windowEnd && d.deliveredAt > d.windowEnd),
    hasPod: Boolean(d.proofOfDelivery),
    damaged: d.damageReports.length > 0,
    customerIssues: d.customerServiceCases.length,
    returnOutstanding: d.returnTasks.some((r) => r.status !== "CLOSED"),
  }));

  return { summary, rows };
}
