import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAdminDashboard } from "@/lib/permissions";
import { computeEodReport } from "@/lib/eodReport";
import { DELIVERY_STATUS_LABEL } from "@/lib/status-workflow";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function EodReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; routeId?: string; driverId?: string; vehicleId?: string; organisationId?: string };
}) {
  const session = await auth();
  if (!session || !canViewAdminDashboard(session.user.role)) redirect("/login");

  const from = searchParams.from ? new Date(searchParams.from) : new Date();
  from.setHours(0, 0, 0, 0);
  const to = searchParams.to ? new Date(searchParams.to) : new Date(from);
  to.setHours(23, 59, 59, 999);

  const [report, routes, drivers, vehicles, organisations] = await Promise.all([
    computeEodReport({
      from,
      to,
      routeId: searchParams.routeId || undefined,
      driverId: searchParams.driverId || undefined,
      vehicleId: searchParams.vehicleId || undefined,
      organisationId: searchParams.organisationId || undefined,
    }),
    prisma.route.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "DRIVER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.vehicle.findMany({ orderBy: { registration: "asc" }, select: { id: true, registration: true } }),
    prisma.organisation.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
  ]);

  const qs = new URLSearchParams({
    from: searchParams.from ?? todayStr(),
    to: searchParams.to ?? todayStr(),
    ...(searchParams.routeId ? { routeId: searchParams.routeId } : {}),
    ...(searchParams.driverId ? { driverId: searchParams.driverId } : {}),
    ...(searchParams.vehicleId ? { vehicleId: searchParams.vehicleId } : {}),
    ...(searchParams.organisationId ? { organisationId: searchParams.organisationId } : {}),
  });

  const tiles: [string, number][] = [
    ["Total jobs", report.summary.totalJobs],
    ["Delivered", report.summary.delivered],
    ["Partially delivered", report.summary.partiallyDelivered],
    ["Failed", report.summary.failed],
    ["Cancelled", report.summary.cancelled],
    ["Damaged", report.summary.damaged],
    ["Outstanding", report.summary.outstanding],
    ["Missing POD", report.summary.missingPod],
    ["Customer issues", report.summary.customerIssues],
    ["Late deliveries", report.summary.lateDeliveries],
    ["Driver incidents", report.summary.driverIncidents],
    ["Return tasks (outstanding)", report.summary.returnTasksOutstanding],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">End-of-day run report</h1>
          <p className="text-sm text-dim">Filter by date, route, driver, vehicle, or client.</p>
        </div>
        <a href={`/api/reports/eod?${qs.toString()}&format=csv`} className="btn-secondary">
          Export CSV
        </a>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">From</label>
          <input type="date" name="from" defaultValue={searchParams.from ?? todayStr()} className="field-input" />
        </div>
        <div>
          <label className="field-label">To</label>
          <input type="date" name="to" defaultValue={searchParams.to ?? todayStr()} className="field-input" />
        </div>
        <div>
          <label className="field-label">Route</label>
          <select name="routeId" defaultValue={searchParams.routeId ?? ""} className="field-input">
            <option value="">All</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Driver</label>
          <select name="driverId" defaultValue={searchParams.driverId ?? ""} className="field-input">
            <option value="">All</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Vehicle</label>
          <select name="vehicleId" defaultValue={searchParams.vehicleId ?? ""} className="field-input">
            <option value="">All</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registration}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Client</label>
          <select name="organisationId" defaultValue={searchParams.organisationId ?? ""} className="field-input">
            <option value="">All</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.companyName}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-sm text-dim">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Arrival</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{r.customerName}</td>
                <td className="px-4 py-3 text-dim">{r.driverName ?? "—"}</td>
                <td className="px-4 py-3 text-dim">{r.vehicleRegistration ?? "—"}</td>
                <td className="px-4 py-3 text-dim">{DELIVERY_STATUS_LABEL[r.status as keyof typeof DELIVERY_STATUS_LABEL]}</td>
                <td className="px-4 py-3 text-dim">{r.arrivedAt ? new Date(r.arrivedAt).toLocaleTimeString("en-AU") : "—"}</td>
                <td className="px-4 py-3 text-dim">{r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString("en-AU") : "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {r.late && <span className="mr-1 rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[#DC2626]">Late</span>}
                  {!r.hasPod && <span className="mr-1 rounded bg-[#FFF7ED] px-1.5 py-0.5 text-[#C2410C]">No POD</span>}
                  {r.damaged && <span className="mr-1 rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[#DC2626]">Damaged</span>}
                  {r.customerIssues > 0 && <span className="mr-1 rounded bg-[#FFF7ED] px-1.5 py-0.5 text-[#C2410C]">{r.customerIssues} case(s)</span>}
                  {r.returnOutstanding && <span className="mr-1 rounded bg-[#FFF7ED] px-1.5 py-0.5 text-[#C2410C]">Return outstanding</span>}
                </td>
              </tr>
            ))}
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No jobs in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
