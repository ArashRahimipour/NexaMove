import { prisma } from "@/lib/prisma";

export default async function AuditLogPage() {
  const entries = await prisma.auditLog.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Record</th>
              <th className="px-4 py-3">Before → After</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-3 text-dim">{new Date(e.createdAt).toLocaleString("en-AU")}</td>
                <td className="px-4 py-3">{e.user?.name ?? "System"}</td>
                <td className="px-4 py-3 font-medium">{e.action}</td>
                <td className="px-4 py-3 text-dim">
                  {e.recordType}
                  {e.recordId ? ` #${e.recordId.slice(0, 8)}` : ""}
                </td>
                <td className="max-w-md px-4 py-3 text-xs text-muted">
                  {e.beforeValue && <div className="truncate">− {e.beforeValue}</div>}
                  {e.afterValue && <div className="truncate">+ {e.afterValue}</div>}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
