import {
  Package,
  CheckCircle2,
  PackageCheck,
  Truck,
  XCircle,
  ShieldAlert,
  Clock3,
  Users,
  Percent,
  Timer,
  Star,
  Box,
  DollarSign,
  Wallet,
  Coins,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

const TILE_META: Record<string, { icon: LucideIcon; accent: string }> = {
  "Total deliveries": { icon: Package, accent: "text-brand-400" },
  "Delivered": { icon: CheckCircle2, accent: "text-ok" },
  "Partially delivered": { icon: PackageCheck, accent: "text-warn" },
  "In transit": { icon: Truck, accent: "text-brand-400" },
  "Failed": { icon: XCircle, accent: "text-danger" },
  "Damaged": { icon: ShieldAlert, accent: "text-warn" },
  "Awaiting dispatch": { icon: Clock3, accent: "text-dim" },
  "Active drivers": { icon: Users, accent: "text-brand-400" },
  "Completion rate": { icon: Percent, accent: "text-ok" },
  "DIFOT (on-time)": { icon: Timer, accent: "text-brand-400" },
  "Failed delivery %": { icon: XCircle, accent: "text-danger" },
  "Damage %": { icon: ShieldAlert, accent: "text-warn" },
  "Avg customer rating": { icon: Star, accent: "text-warn" },
  "CBM delivered": { icon: Box, accent: "text-brand-400" },
  "Revenue": { icon: DollarSign, accent: "text-ok" },
  "Driver cost": { icon: Wallet, accent: "text-dim" },
  "Company retained": { icon: Coins, accent: "text-ok" },
  "Avg deliveries / driver": { icon: Gauge, accent: "text-brand-400" },
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Every number on this page used to be computed by loading every matching
// Delivery row (plus its damageReports/customerRating relations) into Node
// and reducing over them in JS — on a real date range that's thousands of
// full rows fetched just to produce ~18 numbers. All of it is now pushed
// down to the database as counts/aggregates (one FILTER-based raw query for
// the DIFOT on-time comparison, which needs a column-to-column comparison
// Prisma's query builder can't express) — nothing but the final numbers
// crosses the network.
async function loadKpis(from: Date, to: Date) {
  const dateWhere = { createdAt: { gte: from, lte: to } };

  const [statusCounts, totals, damagedCount, ratingAgg, onTimeRows, activeDrivers] = await Promise.all([
    prisma.delivery.groupBy({ by: ["status"], where: dateWhere, _count: { _all: true } }),
    prisma.delivery.aggregate({
      where: dateWhere,
      _count: { _all: true },
      _sum: { cbm: true, totalCharge: true, driverPayment: true },
    }),
    prisma.delivery.count({ where: { ...dateWhere, damageReports: { some: {} } } }),
    prisma.customerRating.aggregate({
      where: { delivery: dateWhere },
      _avg: { stars: true },
    }),
    prisma.$queryRaw<{ on_time: number; with_window: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "deliveredAt" <= "windowEnd")::int AS on_time,
        COUNT(*)::int AS with_window
      FROM "deliveries"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND "deliveredAt" IS NOT NULL AND "windowEnd" IS NOT NULL
    `,
    prisma.user.count({ where: { role: "DRIVER", active: true } }),
  ]);

  const countFor = (statuses: string[]) =>
    statusCounts.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + s._count._all, 0);

  return {
    total: totals._count._all,
    delivered: countFor(["DELIVERED"]),
    partiallyDelivered: countFor(["PARTIALLY_DELIVERED"]),
    failed: countFor(["FAILED"]),
    damaged: damagedCount,
    inTransit: countFor(["ROUTE_STARTED", "IN_TRANSIT", "DRIVER_NEARBY", "ARRIVED"]),
    awaitingDispatch: countFor(["PENDING", "READY_FOR_DISPATCH"]),
    onTime: onTimeRows[0]?.on_time ?? 0,
    withWindow: onTimeRows[0]?.with_window ?? 0,
    avgRatingStars: ratingAgg._avg.stars,
    totalCbm: totals._sum.cbm ?? 0,
    revenue: totals._sum.totalCharge ?? 0,
    driverCost: totals._sum.driverPayment ?? 0,
    activeDrivers,
  };
}

export default async function KpiPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const from = searchParams.from ? new Date(searchParams.from) : (() => {
    const d = startOfToday();
    d.setDate(d.getDate() - 30);
    return d;
  })();
  const to = searchParams.to ? new Date(searchParams.to) : new Date();

  const {
    total,
    delivered,
    partiallyDelivered,
    failed,
    damaged,
    inTransit,
    awaitingDispatch,
    onTime,
    withWindow,
    avgRatingStars,
    totalCbm,
    revenue,
    driverCost,
    activeDrivers,
  } = await loadKpis(from, to);

  const difot = withWindow > 0 ? ((onTime / withWindow) * 100).toFixed(1) : "—";
  const completionRate = total > 0 ? (((delivered + partiallyDelivered) / total) * 100).toFixed(1) : "—";
  const failedRate = total > 0 ? ((failed / total) * 100).toFixed(1) : "—";
  const damageRate = total > 0 ? ((damaged / total) * 100).toFixed(1) : "—";
  const avgRating = avgRatingStars != null ? avgRatingStars.toFixed(1) : "—";
  const companyRetained = revenue - driverCost;
  const avgPerDriver = activeDrivers > 0 ? (total / activeDrivers).toFixed(1) : "—";

  const tiles: { label: string; value: string | number }[] = [
    { label: "Total deliveries", value: total },
    { label: "Delivered", value: delivered },
    { label: "Partially delivered", value: partiallyDelivered },
    { label: "In transit", value: inTransit },
    { label: "Failed", value: failed },
    { label: "Damaged", value: damaged },
    { label: "Awaiting dispatch", value: awaitingDispatch },
    { label: "Active drivers", value: activeDrivers },
    { label: "Completion rate", value: `${completionRate}%` },
    { label: "DIFOT (on-time)", value: typeof difot === "string" ? difot : `${difot}%` },
    { label: "Failed delivery %", value: `${failedRate}%` },
    { label: "Damage %", value: `${damageRate}%` },
    { label: "Avg customer rating", value: avgRating === "—" ? "—" : `${avgRating} ★` },
    { label: "CBM delivered", value: `${totalCbm.toFixed(1)} m³` },
    { label: "Revenue", value: `$${revenue.toFixed(2)}` },
    { label: "Driver cost", value: `$${driverCost.toFixed(2)}` },
    { label: "Company retained", value: `$${companyRetained.toFixed(2)}` },
    { label: "Avg deliveries / driver", value: avgPerDriver },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">KPI dashboard</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">From</label>
          <input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} className="field-input" />
        </div>
        <div>
          <label className="field-label">To</label>
          <input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} className="field-input" />
        </div>
        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const meta = TILE_META[t.label];
          const Icon = meta?.icon ?? Package;
          return (
            <div key={t.label} className="card card-hover">
              <div className={`mb-3 inline-flex rounded-[10px] bg-elevated p-2 ${meta?.accent ?? "text-brand-400"}`}>
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="text-sm text-dim">{t.label}</p>
              <p className="mt-1 text-2xl font-bold text-ink">{t.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
