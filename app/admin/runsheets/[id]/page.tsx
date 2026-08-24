import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canManageRunsheetImports } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ResolveRunsheetRowButton } from "@/components/ResolveRunsheetRowButton";

const STATUS_COLOR: Record<string, string> = {
  MATCHED: "bg-[#DCFCE7] text-[#16A34A]",
  VARIANCE: "bg-[#FEF9C3] text-[#A16207]",
  PENDING: "bg-elevated text-dim",
  UNMATCHED: "bg-[#FEE2E2] text-[#DC2626]",
};

export default async function RunsheetDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || !canManageRunsheetImports(session.user.role)) redirect("/login");

  const runsheetImport = await prisma.runsheetImport.findUnique({
    where: { id: params.id },
    include: {
      organisation: { select: { companyName: true } },
      importedBy: { select: { name: true } },
      rows: {
        include: {
          delivery: { select: { trackingCode: true, customerName: true, totalCharge: true, status: true } },
          resolvedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!runsheetImport) notFound();

  const varianceCount = runsheetImport.rows.filter((r) => r.reconciliationStatus === "VARIANCE" && !r.resolvedAt).length;
  const unmatchedCount = runsheetImport.rows.filter((r) => r.reconciliationStatus === "UNMATCHED" && !r.resolvedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{runsheetImport.fileName}</h1>
        <p className="text-sm text-dim">
          {runsheetImport.source} · imported {new Date(runsheetImport.importedAt).toLocaleString("en-AU")} by{" "}
          {runsheetImport.importedBy.name}
          {runsheetImport.organisation && <> · {runsheetImport.organisation.companyName}</>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-sm text-dim">Rows</p>
          <p className="text-2xl font-bold">{runsheetImport.totalRows}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dim">Matched</p>
          <p className="text-2xl font-bold">{runsheetImport.matchedRows}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dim">Unresolved variances</p>
          <p className="text-2xl font-bold">{varianceCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dim">Unresolved unmatched</p>
          <p className="text-2xl font-bold">{unmatchedCount}</p>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Matched delivery</th>
              <th className="px-4 py-3">Match type</th>
              <th className="px-4 py-3">Portal amount</th>
              <th className="px-4 py-3">NexaMove charge</th>
              <th className="px-4 py-3">Variance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {runsheetImport.rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">{row.externalReference ?? "—"}</td>
                <td className="px-4 py-3 text-dim">
                  {row.delivery ? `${row.delivery.customerName} (${row.delivery.trackingCode.slice(0, 8)})` : "—"}
                </td>
                <td className="px-4 py-3 text-dim">{row.matchType ?? "No match"}</td>
                <td className="px-4 py-3">{row.portalAmount != null ? `$${row.portalAmount.toFixed(2)}` : "—"}</td>
                <td className="px-4 py-3">{row.delivery?.totalCharge != null ? `$${row.delivery.totalCharge.toFixed(2)}` : "—"}</td>
                <td className="px-4 py-3">{row.varianceAmount != null ? `$${row.varianceAmount.toFixed(2)}` : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLOR[row.reconciliationStatus] ?? "bg-elevated text-dim"}`}>
                    {row.reconciliationStatus}
                  </span>
                  {row.resolvedAt && (
                    <div className="mt-1 text-xs text-muted">
                      Resolved by {row.resolvedBy?.name} — {row.resolutionNotes}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.reconciliationStatus !== "MATCHED" && !row.resolvedAt && (
                    <ResolveRunsheetRowButton importId={runsheetImport.id} rowId={row.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
