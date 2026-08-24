import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface OpsToolContext {
  role: Role;
  userId: string;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  // If set, only these roles may invoke this tool — enforced server-side,
  // independent of whether the model decides to call it.
  allowedRoles?: Role[];
  handler: (args: Record<string, unknown>, ctx: OpsToolContext) => Promise<unknown>;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

const DELIVERY_SUMMARY_SELECT = {
  id: true,
  trackingCode: true,
  externalReference: true,
  customerName: true,
  suburb: true,
  postcode: true,
  region: true,
  status: true,
  windowStart: true,
  windowEnd: true,
  deliveredAt: true,
  arrivedAt: true,
  route: { select: { id: true, name: true, driver: { select: { id: true, name: true } } } },
} as const;

export const OPERATIONS_TOOLS: ToolDef[] = [
  {
    name: "get_todays_deliveries",
    description: "Get all deliveries scheduled for today, optionally filtered by status.",
    parameters: {
      type: "object",
      properties: { status: { type: "string", description: "Optional delivery status to filter by" } },
    },
    handler: async (args) => {
      const { start, end } = todayRange();
      const deliveries = await prisma.delivery.findMany({
        where: {
          deliveryDate: { gte: start, lt: end },
          ...(args.status ? { status: args.status as never } : {}),
        },
        select: DELIVERY_SUMMARY_SELECT,
        take: 100,
      });
      return { count: deliveries.length, deliveries };
    },
  },
  {
    name: "get_delayed_deliveries",
    description: "Get deliveries currently past their expected delivery window and not yet completed.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const now = new Date();
      const deliveries = await prisma.delivery.findMany({
        where: {
          windowEnd: { lt: now },
          status: { in: ["ASSIGNED", "IN_TRANSIT", "DRIVER_NEARBY", "ARRIVED", "UNLOADING", "ASSEMBLY_IN_PROGRESS"] },
        },
        select: DELIVERY_SUMMARY_SELECT,
        take: 50,
      });
      return { count: deliveries.length, deliveries };
    },
  },
  {
    name: "get_failed_deliveries",
    description: "Get failed delivery reports, optionally for a specific date (YYYY-MM-DD, defaults to today).",
    parameters: { type: "object", properties: { date: { type: "string" } } },
    handler: async (args) => {
      const date = args.date ? new Date(args.date as string) : todayRange().start;
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const reports = await prisma.failedDeliveryReport.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: {
          id: true,
          reason: true,
          notes: true,
          createdAt: true,
          delivery: { select: { id: true, trackingCode: true, customerName: true, suburb: true, status: true } },
        },
        take: 50,
      });
      return { count: reports.length, reports };
    },
  },
  {
    name: "get_damage_reports",
    description: "Get damage reports, optionally for a specific date (YYYY-MM-DD, defaults to today).",
    parameters: { type: "object", properties: { date: { type: "string" } } },
    handler: async (args) => {
      const date = args.date ? new Date(args.date as string) : todayRange().start;
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const reports = await prisma.damageReport.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: {
          id: true,
          discoveredStage: true,
          reason: true,
          description: true,
          responsibility: true,
          createdAt: true,
          delivery: { select: { id: true, trackingCode: true, customerName: true, suburb: true } },
        },
        take: 50,
      });
      return { count: reports.length, reports };
    },
  },
  {
    name: "get_missing_pod_deliveries",
    description: "Get deliveries marked Delivered that have no proof-of-delivery record.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const deliveries = await prisma.delivery.findMany({
        where: { status: "DELIVERED", proofOfDelivery: null },
        select: DELIVERY_SUMMARY_SELECT,
        take: 50,
      });
      return { count: deliveries.length, deliveries };
    },
  },
  {
    name: "get_customer_service_cases",
    description: "Get customer service cases, optionally filtered by status (OPEN, INVESTIGATING, AWAITING_CUSTOMER, AWAITING_OPERATIONS, RESOLVED, CLOSED).",
    parameters: { type: "object", properties: { status: { type: "string" } } },
    handler: async (args) => {
      const cases = await prisma.customerServiceCase.findMany({
        where: args.status
          ? { status: args.status as never }
          : { status: { in: ["OPEN", "INVESTIGATING", "AWAITING_CUSTOMER", "AWAITING_OPERATIONS"] } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          delivery: { select: { id: true, trackingCode: true, customerName: true, suburb: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return { count: cases.length, cases };
    },
  },
  {
    name: "get_driver_compliance",
    description: "Get drivers whose licence has expired or expires within 30 days.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      const drivers = await prisma.driver.findMany({
        where: { active: true, licenceExpiry: { lte: in30Days } },
        select: { id: true, licenceExpiry: true, user: { select: { name: true } } },
      });
      return { count: drivers.length, drivers };
    },
  },
  {
    name: "get_vehicle_compliance",
    description: "Get vehicles whose insurance or registration has expired or expires within 30 days.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      const vehicles = await prisma.vehicle.findMany({
        where: {
          active: true,
          OR: [{ insuranceExpiry: { lte: in30Days } }, { registrationExpiry: { lte: in30Days } }],
        },
        select: { id: true, registration: true, insuranceExpiry: true, registrationExpiry: true },
      });
      return { count: vehicles.length, vehicles };
    },
  },
  {
    name: "get_kpi_summary",
    description: "Get KPI summary (completion rate, DIFOT, failed %, damage %, revenue, driver cost) for a date range. Defaults to the last 30 days.",
    parameters: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
    },
    handler: async (args) => {
      const to = args.to ? new Date(args.to as string) : new Date();
      const from = args.from
        ? new Date(args.from as string)
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            return d;
          })();
      const deliveries = await prisma.delivery.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { damageReports: true },
      });
      const total = deliveries.length;
      const delivered = deliveries.filter((d) => d.status === "DELIVERED" || d.status === "PARTIALLY_DELIVERED").length;
      const failed = deliveries.filter((d) => d.status === "FAILED").length;
      const damaged = deliveries.filter((d) => d.damageReports.length > 0).length;
      const onTime = deliveries.filter((d) => d.deliveredAt && d.windowEnd && d.deliveredAt <= d.windowEnd).length;
      const withWindow = deliveries.filter((d) => d.deliveredAt && d.windowEnd).length;
      const revenue = deliveries.reduce((s, d) => s + (d.totalCharge ?? 0), 0);
      const driverCost = deliveries.reduce((s, d) => s + (d.driverPayment ?? 0), 0);
      return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        totalDeliveries: total,
        completionRatePct: total > 0 ? Number((((delivered) / total) * 100).toFixed(1)) : null,
        difotPct: withWindow > 0 ? Number(((onTime / withWindow) * 100).toFixed(1)) : null,
        failedRatePct: total > 0 ? Number(((failed / total) * 100).toFixed(1)) : null,
        damageRatePct: total > 0 ? Number(((damaged / total) * 100).toFixed(1)) : null,
        revenue: Number(revenue.toFixed(2)),
        driverCost: Number(driverCost.toFixed(2)),
      };
    },
  },
  {
    name: "get_kpi_comparison",
    description: "Compare this week's KPIs against last week's (deliveries, completion rate, failed rate, damage rate).",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      async function weekStats(weeksAgo: number) {
        const end = new Date();
        end.setDate(end.getDate() - weeksAgo * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 7);
        const deliveries = await prisma.delivery.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: { damageReports: true },
        });
        const total = deliveries.length;
        const delivered = deliveries.filter((d) => d.status === "DELIVERED" || d.status === "PARTIALLY_DELIVERED").length;
        const failed = deliveries.filter((d) => d.status === "FAILED").length;
        const damaged = deliveries.filter((d) => d.damageReports.length > 0).length;
        return {
          total,
          completionRatePct: total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : null,
          failedRatePct: total > 0 ? Number(((failed / total) * 100).toFixed(1)) : null,
          damageRatePct: total > 0 ? Number(((damaged / total) * 100).toFixed(1)) : null,
        };
      }
      const [thisWeek, lastWeek] = await Promise.all([weekStats(0), weekStats(1)]);
      return { thisWeek, lastWeek };
    },
  },
  {
    name: "get_driver_performance",
    description: "Get per-driver delivery counts, failed counts, and average rating over the last N days (default 7).",
    parameters: { type: "object", properties: { days: { type: "number" } } },
    handler: async (args) => {
      const days = typeof args.days === "number" ? args.days : 7;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const routes = await prisma.route.findMany({
        where: { date: { gte: since } },
        include: {
          driver: { select: { id: true, name: true } },
          deliveries: { select: { status: true, customerRating: { select: { stars: true } } } },
        },
      });
      const byDriver = new Map<string, { name: string; delivered: number; failed: number; ratings: number[] }>();
      for (const route of routes) {
        if (!route.driver) continue;
        const entry = byDriver.get(route.driver.id) ?? { name: route.driver.name, delivered: 0, failed: 0, ratings: [] };
        for (const d of route.deliveries) {
          if (d.status === "DELIVERED" || d.status === "PARTIALLY_DELIVERED") entry.delivered++;
          if (d.status === "FAILED") entry.failed++;
          if (d.customerRating) entry.ratings.push(d.customerRating.stars);
        }
        byDriver.set(route.driver.id, entry);
      }
      const performance = Array.from(byDriver.entries()).map(([driverId, v]) => ({
        driverId,
        name: v.name,
        delivered: v.delivered,
        failed: v.failed,
        avgRating: v.ratings.length > 0 ? Number((v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length).toFixed(1)) : null,
      }));
      return { days, performance };
    },
  },
  {
    name: "get_region_performance",
    description: "Get completion rate by region over the last N days (default 7).",
    parameters: { type: "object", properties: { days: { type: "number" } } },
    handler: async (args) => {
      const days = typeof args.days === "number" ? args.days : 7;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const deliveries = await prisma.delivery.findMany({
        where: { createdAt: { gte: since } },
        select: { region: true, status: true },
      });
      const byRegion = new Map<string, { total: number; delivered: number; failed: number }>();
      for (const d of deliveries) {
        const entry = byRegion.get(d.region) ?? { total: 0, delivered: 0, failed: 0 };
        entry.total++;
        if (d.status === "DELIVERED" || d.status === "PARTIALLY_DELIVERED") entry.delivered++;
        if (d.status === "FAILED") entry.failed++;
        byRegion.set(d.region, entry);
      }
      const regions = Array.from(byRegion.entries()).map(([region, v]) => ({
        region,
        total: v.total,
        completionRatePct: v.total > 0 ? Number(((v.delivered / v.total) * 100).toFixed(1)) : null,
        failedRatePct: v.total > 0 ? Number(((v.failed / v.total) * 100).toFixed(1)) : null,
      }));
      return { days, regions };
    },
  },
  {
    name: "get_operational_alerts",
    description: "Get operational alerts, optionally filtered by status (OPEN, ACKNOWLEDGED, RESOLVED). Defaults to open alerts.",
    parameters: { type: "object", properties: { status: { type: "string" } } },
    handler: async (args) => {
      const alerts = await prisma.alert.findMany({
        where: { status: (args.status as never) ?? "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return { count: alerts.length, alerts };
    },
  },
  {
    name: "get_recent_audit_activity",
    description: "Get recent audit log entries (status changes, damage responsibility, settlement approvals, settings changes) from the last N hours (default 24). Admin/Operations Manager only.",
    parameters: { type: "object", properties: { hours: { type: "number" } } },
    allowedRoles: ["ADMIN", "OPERATIONS_MANAGER"],
    handler: async (args) => {
      const hours = typeof args.hours === "number" ? args.hours : 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const entries = await prisma.auditLog.findMany({
        where: { createdAt: { gte: since } },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { count: entries.length, entries };
    },
  },
  {
    name: "get_settlement_summary",
    description: "Get settlement totals grouped by status (Draft, Review, Approved, Paid). Admin/Operations Manager only.",
    parameters: { type: "object", properties: {} },
    allowedRoles: ["ADMIN", "OPERATIONS_MANAGER"],
    handler: async () => {
      const settlements = await prisma.settlement.findMany({
        select: { status: true, grossAmount: true, driverShare: true, companyShare: true },
      });
      const byStatus = new Map<string, { count: number; grossAmount: number }>();
      for (const s of settlements) {
        const entry = byStatus.get(s.status) ?? { count: 0, grossAmount: 0 };
        entry.count++;
        entry.grossAmount += s.grossAmount;
        byStatus.set(s.status, entry);
      }
      return { byStatus: Array.from(byStatus.entries()).map(([status, v]) => ({ status, ...v })) };
    },
  },
  {
    name: "get_delivery_details",
    description: "Get full details for one delivery by its tracking code, ID, or external reference.",
    parameters: { type: "object", properties: { reference: { type: "string" } } },
    handler: async (args) => {
      const reference = String(args.reference ?? "");
      const delivery = await prisma.delivery.findFirst({
        where: { OR: [{ id: reference }, { trackingCode: reference }, { externalReference: reference }] },
        include: {
          route: { select: { id: true, name: true, driver: { select: { name: true } } } },
          proofOfDelivery: { select: { receiverName: true, capturedAt: true, contactless: true } },
          damageReports: { select: { reason: true, description: true, responsibility: true } },
          failedDeliveryReports: { select: { reason: true, notes: true, createdAt: true } },
          customerServiceCases: { select: { id: true, status: true } },
        },
      });
      if (!delivery) return { found: false };
      return { found: true, delivery };
    },
  },
  {
    name: "get_driver_status",
    description: "Get a driver's current route and today's deliveries by driver name or ID.",
    parameters: { type: "object", properties: { driver: { type: "string" } } },
    handler: async (args) => {
      const query = String(args.driver ?? "");
      const { start, end } = todayRange();
      const driver = await prisma.user.findFirst({
        where: { role: "DRIVER", OR: [{ id: query }, { name: { contains: query, mode: "insensitive" } }] },
        select: {
          id: true,
          name: true,
          active: true,
          driverRoutes: {
            where: { date: { gte: start, lt: end } },
            select: {
              id: true,
              name: true,
              status: true,
              deliveries: { select: { id: true, status: true, customerName: true, suburb: true, sequence: true } },
            },
          },
        },
      });
      if (!driver) return { found: false };
      return { found: true, driver };
    },
  },
  {
    name: "get_route_status",
    description: "Get a route's status and stop list by route name or ID.",
    parameters: { type: "object", properties: { route: { type: "string" } } },
    handler: async (args) => {
      const query = String(args.route ?? "");
      const route = await prisma.route.findFirst({
        where: { OR: [{ id: query }, { name: { contains: query, mode: "insensitive" } }] },
        include: {
          driver: { select: { name: true } },
          deliveries: { select: { id: true, status: true, customerName: true, suburb: true, sequence: true } },
        },
      });
      if (!route) return { found: false };
      return { found: true, route };
    },
  },
  {
    name: "get_outstanding_cbm",
    description: "Get total CBM still outstanding (not yet delivered) for today's deliveries.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const { start, end } = todayRange();
      const deliveries = await prisma.delivery.findMany({
        where: {
          deliveryDate: { gte: start, lt: end },
          status: { notIn: ["DELIVERED", "CANCELLED", "RETURNED"] },
        },
        select: { cbm: true },
      });
      const outstandingCbm = deliveries.reduce((s, d) => s + (d.cbm ?? 0), 0);
      return { outstandingCbm: Number(outstandingCbm.toFixed(2)), pendingCount: deliveries.length };
    },
  },
  {
    name: "create_customer_service_case",
    description: "Open a new customer service case against a delivery.",
    parameters: {
      type: "object",
      properties: {
        deliveryReference: { type: "string", description: "Delivery ID or tracking code" },
        note: { type: "string", description: "Description of the issue" },
      },
      required: ["deliveryReference", "note"],
    },
    handler: async (args, ctx) => {
      const reference = String(args.deliveryReference ?? "");
      const delivery = await prisma.delivery.findFirst({
        where: { OR: [{ id: reference }, { trackingCode: reference }] },
      });
      if (!delivery) return { created: false, error: "Delivery not found" };
      const created = await prisma.customerServiceCase.create({
        data: {
          deliveryId: delivery.id,
          openedById: ctx.userId,
          notes: { create: { authorId: ctx.userId, note: String(args.note ?? "") } },
        },
      });
      return { created: true, caseId: created.id };
    },
  },
];

export function toolsForRole(role: Role): ToolDef[] {
  return OPERATIONS_TOOLS.filter((t) => !t.allowedRoles || t.allowedRoles.includes(role));
}

export function canUseOperationsAi(role: Role): boolean {
  return ["ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE"].includes(role);
}
