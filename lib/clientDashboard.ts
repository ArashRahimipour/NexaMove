import { prisma } from "@/lib/prisma";
import { computeReturnSlaBand } from "@/lib/returns";

// Retail client dashboard — built generically for any client (Koala being
// the first), never hard-coded to one organisation. "Financial" here is
// deliberately limited to the client's own charged total (what they were
// billed), never driver payment or company margin, which retail clients
// have no visibility into anywhere else in this app either.
export async function computeClientDashboard(organisationId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [todayDeliveries, periodDeliveries, activeDriverIds, returnTasks, openCasesCount, financialTotal] = await Promise.all([
    prisma.delivery.findMany({
      where: { organisationId, deliveryDate: { gte: today, lt: tomorrow } },
      select: { status: true, deliveredAt: true, windowEnd: true },
    }),
    prisma.delivery.findMany({
      where: { organisationId, createdAt: { gte: thirtyDaysAgo } },
      include: {
        proofOfDelivery: { select: { id: true } },
        damageReports: { select: { id: true } },
        failedDeliveryReports: { select: { id: true } },
        preDeliveryConfirmations: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.route.findMany({
      where: { deliveries: { some: { organisationId } }, date: { gte: thirtyDaysAgo } },
      select: { driverId: true },
      distinct: ["driverId"],
    }),
    prisma.returnTask.findMany({
      where: { delivery: { organisationId }, createdAt: { gte: thirtyDaysAgo } },
      select: { status: true, slaDeadline: true, closedAt: true, collectedAt: true },
    }),
    prisma.customerServiceCase.count({
      where: { delivery: { organisationId }, status: { in: ["OPEN", "INVESTIGATING", "AWAITING_CUSTOMER", "AWAITING_OPERATIONS"] } },
    }),
    prisma.delivery.aggregate({
      where: { organisationId, createdAt: { gte: thirtyDaysAgo } },
      _sum: { totalCharge: true },
    }),
  ]);

  const driverIds = activeDriverIds.map((r) => r.driverId).filter((id): id is string => Boolean(id));

  const [drivers, latestAudits] = await Promise.all([
    driverIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: driverIds } },
          include: { driverProfile: true },
        })
      : Promise.resolve([]),
    driverIds.length > 0
      ? prisma.warehouseAudit.findMany({
          where: { driverId: { in: driverIds }, OR: [{ organisationId }, { organisationId: null }] },
          orderBy: { auditedAt: "desc" },
          include: { items: { where: { result: "FAIL" } } },
        })
      : Promise.resolve([]),
  ]);

  const today_ = {
    scheduled: todayDeliveries.length,
    loadedOrScanned: todayDeliveries.filter((d) => !["DRAFT", "PENDING", "READY_FOR_DISPATCH", "ASSIGNED"].includes(d.status)).length,
    dispatched: todayDeliveries.filter((d) => !["DRAFT", "PENDING", "READY_FOR_DISPATCH", "ASSIGNED", "LOADED"].includes(d.status)).length,
    inTransit: todayDeliveries.filter((d) => ["ROUTE_STARTED", "IN_TRANSIT", "DRIVER_NEARBY"].includes(d.status)).length,
    delivered: todayDeliveries.filter((d) => ["DELIVERED", "PARTIALLY_DELIVERED"].includes(d.status)).length,
    failed: todayDeliveries.filter((d) => d.status === "FAILED").length,
    delayed: todayDeliveries.filter((d) => !d.deliveredAt && d.windowEnd && new Date() > d.windowEnd).length,
  };

  const total = periodDeliveries.length;
  const finished = periodDeliveries.filter((d) => ["DELIVERED", "PARTIALLY_DELIVERED", "FAILED"].includes(d.status));
  const delivered = periodDeliveries.filter((d) => ["DELIVERED", "PARTIALLY_DELIVERED"].includes(d.status));
  const withWindow = periodDeliveries.filter((d) => d.deliveredAt && d.windowEnd);
  const onTime = withWindow.filter((d) => d.deliveredAt! <= d.windowEnd!);
  const firstAttemptSuccess = delivered.filter((d) => d.failedDeliveryReports.length === 0);
  const confirmed = periodDeliveries.filter((d) => d.preDeliveryConfirmations[0]?.status === "CONFIRMED");

  const closedReturnTasks = returnTasks.filter((r) => r.status === "CLOSED" && r.closedAt && r.collectedAt);
  const returnsWithinSla = closedReturnTasks.filter((r) => r.closedAt!.getTime() - r.collectedAt!.getTime() <= 48 * 60 * 60 * 1000);

  const service = {
    onTimePercent: withWindow.length > 0 ? round1((onTime.length / withWindow.length) * 100) : null,
    firstAttemptPercent: delivered.length > 0 ? round1((firstAttemptSuccess.length / delivered.length) * 100) : null,
    podCompletionPercent: finished.length > 0 ? round1((periodDeliveries.filter((d) => d.proofOfDelivery).length / finished.length) * 100) : null,
    damagePercent: total > 0 ? round1((periodDeliveries.filter((d) => d.damageReports.length > 0).length / total) * 100) : null,
    contactCompletionPercent: total > 0 ? round1((confirmed.length / total) * 100) : null,
    failedPercent: total > 0 ? round1((periodDeliveries.filter((d) => d.status === "FAILED").length / total) * 100) : null,
    returnSlaPercent: closedReturnTasks.length > 0 ? round1((returnsWithinSla.length / closedReturnTasks.length) * 100) : null,
  };

  const driverCompliance = drivers.map((driver) => {
    const licenceExpiry = driver.driverProfile?.licenceExpiry;
    const licenceExpiringSoon = licenceExpiry ? licenceExpiry.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 : false;
    const audit = latestAudits.find((a) => a.driverId === driver.id);
    return {
      id: driver.id,
      name: driver.name,
      active: driver.active,
      licenceExpiringSoon,
      lastAuditPassed: audit ? audit.items.length === 0 : null,
      lastAuditDate: audit?.auditedAt ?? null,
    };
  });

  const outstandingReturns = returnTasks.filter((r) => r.status !== "CLOSED");
  const overdueReturns = outstandingReturns.filter((r) => computeReturnSlaBand({ status: r.status, slaDeadline: r.slaDeadline }) === "OVERDUE");

  const exceptions = {
    damages: periodDeliveries.filter((d) => d.damageReports.length > 0).length,
    openCustomerCases: openCasesCount,
    missingPod: finished.filter((d) => d.status !== "FAILED" && !d.proofOfDelivery).length,
    overdueReturns: overdueReturns.length,
    failedDeliveries: periodDeliveries.filter((d) => d.status === "FAILED").length,
    lateJobs: onTime.length > 0 ? withWindow.length - onTime.length : 0,
  };

  return {
    today: today_,
    service,
    drivers: driverCompliance,
    exceptions,
    financial: {
      totalCharged: financialTotal._sum.totalCharge ?? 0,
      periodDays: 30,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
