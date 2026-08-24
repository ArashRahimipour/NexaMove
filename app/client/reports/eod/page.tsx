import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { computeEodReport } from "@/lib/eodReport";
import { DELIVERY_STATUS_LABEL } from "@/lib/status-workflow";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ClientEodReportPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "RETAIL_CLIENT") redirect("/login");
  const organisationId = session.user.organisationId;

  const from = searchParams.from ? new Date(searchParams.from) : new Date();
  from.setHours(0, 0, 0, 0);
  const to = searchParams.to ? new Date(searchParams.to) : new Date(from);
  to.setHours(23, 59, 59, 999);

  const report = organisationId
    ? await computeEodReport({ from, to, organisationId })
    : { summary: null, rows: [] };

  const qs = new URLSearchParams({ from: searchParams.from ?? todayStr(), to: searchParams.to ?? todayStr() });

  if (!organisationId) {
    return <div className="card text-center text-[#C2410C]">Your account isn&apos;t linked to a retail client organisation yet.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">End-of-day run report</h1>
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
        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      {report.summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Total jobs", report.summary.totalJobs],
              ["Delivered", report.summary.delivered],
              ["Failed", report.summary.failed],
              ["Cancelled", report.summary.cancelled],
              ["Damaged", report.summary.damaged],
              ["Outstanding", report.summary.outstanding],
              ["Late deliveries", report.summary.lateDeliveries],
              ["Return tasks outstanding", report.summary.returnTasksOutstanding],
            ] as [string, number][]
          ).map(([label, value]) => (
            <div key={label} className="card">
              <p className="text-sm text-dim">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{r.customerName}</td>
                <td className="px-4 py-3 text-dim">{DELIVERY_STATUS_LABEL[r.status as keyof typeof DELIVERY_STATUS_LABEL]}</td>
                <td className="px-4 py-3 text-dim">{r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString("en-AU") : "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {r.late && <span className="mr-1 rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[#DC2626]">Late</span>}
                  {r.damaged && <span className="mr-1 rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[#DC2626]">Damaged</span>}
                  {r.returnOutstanding && <span className="mr-1 rounded bg-[#FFF7ED] px-1.5 py-0.5 text-[#C2410C]">Return outstanding</span>}
                </td>
              </tr>
            ))}
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
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
