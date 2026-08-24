import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { computeClientDashboard } from "@/lib/clientDashboard";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <p className="text-sm text-dim">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function pct(v: number | null) {
  return v === null ? "—" : `${v}%`;
}

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session || session.user.role !== "RETAIL_CLIENT") redirect("/login");
  const organisationId = session.user.organisationId;

  if (!organisationId) {
    return <div className="card text-center text-[#C2410C]">Your account isn&apos;t linked to a retail client organisation yet.</div>;
  }

  const dash = await computeClientDashboard(organisationId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-dim">Today&apos;s operations, and service KPIs over the last 30 days.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Today</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Tile label="Scheduled" value={dash.today.scheduled} />
          <Tile label="Loaded/scanned" value={dash.today.loadedOrScanned} />
          <Tile label="Dispatched" value={dash.today.dispatched} />
          <Tile label="In transit" value={dash.today.inTransit} />
          <Tile label="Delivered" value={dash.today.delivered} />
          <Tile label="Failed" value={dash.today.failed} />
          <Tile label="Delayed" value={dash.today.delayed} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Service (last 30 days)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="On-time delivery" value={pct(dash.service.onTimePercent)} />
          <Tile label="First attempt success" value={pct(dash.service.firstAttemptPercent)} />
          <Tile label="POD completion" value={pct(dash.service.podCompletionPercent)} />
          <Tile label="Damage rate" value={pct(dash.service.damagePercent)} />
          <Tile label="Contact completion" value={pct(dash.service.contactCompletionPercent)} />
          <Tile label="Failed delivery rate" value={pct(dash.service.failedPercent)} />
          <Tile label="Return SLA compliance" value={pct(dash.service.returnSlaPercent)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Drivers</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-dim">
              <tr>
                <th className="px-4 py-2">Driver</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Licence</th>
                <th className="px-4 py-2">Last weekly audit</th>
              </tr>
            </thead>
            <tbody>
              {dash.drivers.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="px-4 py-2 text-dim">{d.active ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-2">
                    {d.licenceExpiringSoon ? (
                      <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-xs text-[#C2410C]">Expiring soon</span>
                    ) : (
                      <span className="text-xs text-dim">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {d.lastAuditDate ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${d.lastAuditPassed ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
                        {d.lastAuditPassed ? "Pass" : "Issues"} · {new Date(d.lastAuditDate).toLocaleDateString("en-AU")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">No audit yet</span>
                    )}
                  </td>
                </tr>
              ))}
              {dash.drivers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    No drivers have run your deliveries in the last 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Exceptions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="Damages" value={dash.exceptions.damages} />
          <Tile label="Open cases" value={dash.exceptions.openCustomerCases} />
          <Tile label="Missing POD" value={dash.exceptions.missingPod} />
          <Tile label="Overdue returns" value={dash.exceptions.overdueReturns} />
          <Tile label="Failed deliveries" value={dash.exceptions.failedDeliveries} />
          <Tile label="Late jobs" value={dash.exceptions.lateJobs} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Financial</h2>
        <p className="text-xs text-muted">Your own charged total only — driver payments and NexaMove&apos;s margin are never shown here.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={`Total charged (last ${dash.financial.periodDays}d)`} value={`$${dash.financial.totalCharged.toFixed(2)}`} />
        </div>
      </section>
    </div>
  );
}
