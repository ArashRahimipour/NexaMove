import { prisma } from "@/lib/prisma";
import { GenerateSettlementForm } from "@/components/GenerateSettlementForm";
import { SettlementStatusButtons } from "@/components/SettlementStatusButtons";

export default async function SettlementsPage() {
  const [settlements, drivers] = await Promise.all([
    prisma.settlement.findMany({ include: { driver: { include: { user: true } } }, orderBy: { periodStart: "desc" } }),
    prisma.driver.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Driver settlements</h1>
        <GenerateSettlementForm drivers={drivers.map((d) => ({ id: d.id, name: d.user.name }))} />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Driver share</th>
              <th className="px-4 py-3">Company share</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{s.driver.user.name}</td>
                <td className="px-4 py-3 text-dim">
                  {new Date(s.periodStart).toLocaleDateString("en-AU")} – {new Date(s.periodEnd).toLocaleDateString("en-AU")}
                </td>
                <td className="px-4 py-3">${s.grossAmount.toFixed(2)}</td>
                <td className="px-4 py-3">${s.driverShare.toFixed(2)}</td>
                <td className="px-4 py-3">${s.companyShare.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-elevated px-2 py-1 text-xs font-medium text-secondary">{s.status}</span>
                </td>
                <td className="px-4 py-3">
                  <SettlementStatusButtons id={s.id} status={s.status} />
                </td>
              </tr>
            ))}
            {settlements.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No settlements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
