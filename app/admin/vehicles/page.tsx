import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageVehicles } from "@/lib/permissions";
import { CreateVehicleForm } from "@/components/CreateVehicleForm";
import { DeleteButton } from "@/components/DeleteButton";

export default async function VehiclesPage() {
  const session = await auth();
  const canDelete = session ? canManageVehicles(session.user.role) : false;
  const vehicles = await prisma.vehicle.findMany({
    include: { drivers: { select: { user: { select: { name: true } } } } },
    orderBy: { registration: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vehicles</h1>
        <CreateVehicleForm />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Current driver</th>
              <th className="px-4 py-3">Status</th>
              {canDelete && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{v.registration}</td>
                <td className="px-4 py-3 text-dim">
                  {v.type} {v.make ? `— ${v.make}` : ""}
                </td>
                <td className="px-4 py-3 text-dim">
                  {v.maxCbm ? `${v.maxCbm} m³` : "—"} / {v.maxWeight ? `${v.maxWeight} kg` : "—"}
                </td>
                <td className="px-4 py-3 text-dim">{v.drivers[0]?.user.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${v.active ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-elevated text-dim"}`}>
                    {v.active ? "Active" : "Inactive"}
                  </span>
                </td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <DeleteButton endpoint={`/api/vehicles/${v.id}`} itemLabel="vehicle" />
                  </td>
                )}
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 6 : 5} className="px-4 py-6 text-center text-muted">
                  No vehicles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
