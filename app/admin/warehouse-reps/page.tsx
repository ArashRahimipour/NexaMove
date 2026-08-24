import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageDrivers } from "@/lib/permissions";
import { WarehouseRepShiftForm } from "@/components/WarehouseRepShiftForm";
import { WarehouseRepCheckButtons } from "@/components/WarehouseRepCheckButtons";

export default async function WarehouseRepsPage() {
  const session = await auth();
  if (!session || !canManageDrivers(session.user.role)) redirect("/login");

  const [representatives, organisations, shifts] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE"] }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.organisation.findMany({ where: { active: true }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    prisma.warehouseRepresentativeShift.findMany({
      include: { representative: { select: { name: true } }, organisation: { select: { companyName: true } } },
      orderBy: { date: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Warehouse representatives</h1>
        <p className="text-sm text-dim">Scheduling and check-in/out for the logistics representative present during collections.</p>
      </div>

      <WarehouseRepShiftForm representatives={representatives} organisations={organisations} />

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Representative</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{s.representative.name}</td>
                <td className="px-4 py-3 text-dim">{s.organisation?.companyName ?? "General"}</td>
                <td className="px-4 py-3 text-dim">{s.warehouse}</td>
                <td className="px-4 py-3 text-dim">{new Date(s.date).toLocaleDateString("en-AU")}</td>
                <td className="px-4 py-3 text-dim">{s.shift}</td>
                <td className="px-4 py-3 text-right">
                  <WarehouseRepCheckButtons
                    id={s.id}
                    checkInAt={s.checkInAt?.toISOString() ?? null}
                    checkOutAt={s.checkOutAt?.toISOString() ?? null}
                  />
                </td>
              </tr>
            ))}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No shifts scheduled yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
