import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageDrivers } from "@/lib/permissions";
import { CreateDriverForm } from "@/components/CreateDriverForm";
import { DeleteButton } from "@/components/DeleteButton";

function licenceBadge(expiry: Date | null | undefined) {
  if (!expiry) return null;
  const daysLeft = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return <span className="rounded-full bg-[#FEF2F2] px-2 py-1 text-xs font-medium text-[#DC2626]">Licence expired</span>;
  if (daysLeft <= 30)
    return (
      <span className="rounded-full bg-[#FFF7ED] px-2 py-1 text-xs font-medium text-[#C2410C]">
        Licence expires in {daysLeft}d
      </span>
    );
  return null;
}

export default async function DriversPage() {
  const session = await auth();
  const canDelete = session ? canManageDrivers(session.user.role) : false;
  const drivers = await prisma.user.findMany({
    where: { role: "DRIVER" },
    include: { driverProfile: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Drivers</h1>
        <CreateDriverForm />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Payment split</th>
              <th className="px-4 py-3">Status</th>
              {canDelete && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-dim">{d.email}</td>
                <td className="px-4 py-3 text-dim">{d.phone ?? "—"}</td>
                <td className="px-4 py-3 text-dim">
                  {d.driverProfile ? `${d.driverProfile.paymentSplitPercent}% driver` : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        d.active ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-elevated text-dim"
                      }`}
                    >
                      {d.active ? "Active" : "Inactive"}
                    </span>
                    {licenceBadge(d.driverProfile?.licenceExpiry)}
                  </div>
                </td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <DeleteButton endpoint={`/api/drivers/${d.id}`} itemLabel="driver" />
                  </td>
                )}
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 6 : 5} className="px-4 py-6 text-center text-muted">
                  No drivers yet — add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
