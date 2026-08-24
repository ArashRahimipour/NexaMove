import { PackageCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AssignDeliveryRow } from "@/components/AssignDeliveryRow";
import { EmptyState } from "@/components/EmptyState";

export default async function DispatchPage() {
  // Bounded + column-limited: dispatch only ever needs to act on the front of
  // the unassigned queue, not the whole table with every column (charges,
  // instructions, etc. were being fetched and thrown away on every render).
  const UNASSIGNED_PAGE_SIZE = 200;
  const [unassigned, unassignedTotal, drivers] = await Promise.all([
    prisma.delivery.findMany({
      where: { routeId: null, status: { in: ["PENDING", "READY_FOR_DISPATCH"] } },
      select: {
        id: true,
        customerName: true,
        address: true,
        suburb: true,
        state: true,
        postcode: true,
        cbm: true,
        weight: true,
        deliveryDate: true,
      },
      orderBy: { createdAt: "asc" },
      take: UNASSIGNED_PAGE_SIZE,
    }),
    prisma.delivery.count({ where: { routeId: null, status: { in: ["PENDING", "READY_FOR_DISPATCH"] } } }),
    prisma.user.findMany({
      where: { role: "DRIVER", active: true },
      select: { id: true, name: true, driverProfile: { select: { vehicle: { select: { registration: true, maxCbm: true, maxWeight: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dispatch</h1>
        <p className="text-sm text-dim">
          {unassignedTotal} unassigned deliveries
          {unassignedTotal > unassigned.length && ` (showing oldest ${unassigned.length})`}
        </p>
      </div>

      <div className="space-y-2">
        {unassigned.map((d) => (
          <div key={d.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{d.customerName}</p>
              <p className="text-sm text-dim">
                {d.address}, {d.suburb} {d.state} {d.postcode}
              </p>
              <p className="text-xs text-muted">
                {d.cbm ? `${d.cbm} m³` : "No CBM"} · {d.weight ? `${d.weight} kg` : "No weight"}
                {d.deliveryDate && ` · ${new Date(d.deliveryDate).toLocaleDateString("en-AU")}`}
              </p>
            </div>
            <AssignDeliveryRow deliveryId={d.id} drivers={drivers.map((dr) => ({ id: dr.id, name: dr.name }))} />
          </div>
        ))}
        {unassigned.length === 0 && (
          <EmptyState icon={PackageCheck} title="All caught up" description="No unassigned deliveries right now." />
        )}
      </div>

      <div className="card">
        <p className="mb-2 font-semibold">Driver capacity</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="py-2">Driver</th>
              <th className="py-2">Vehicle</th>
              <th className="py-2">Capacity</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="py-2">{d.name}</td>
                <td className="py-2 text-dim">{d.driverProfile?.vehicle?.registration ?? "No vehicle assigned"}</td>
                <td className="py-2 text-dim">
                  {d.driverProfile?.vehicle?.maxCbm ? `${d.driverProfile.vehicle.maxCbm} m³` : "—"} /{" "}
                  {d.driverProfile?.vehicle?.maxWeight ? `${d.driverProfile.vehicle.maxWeight} kg` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
