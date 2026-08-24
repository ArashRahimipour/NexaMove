import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageServicing } from "@/lib/permissions";
import { formatDays } from "@/lib/servicing";
import { ServicingScheduleForm } from "@/components/ServicingScheduleForm";
import { DeleteButton } from "@/components/DeleteButton";

export default async function ServicingPage() {
  const session = await auth();
  if (!session || !canManageServicing(session.user.role)) redirect("/login");

  const [organisations, schedules] = await Promise.all([
    prisma.organisation.findMany({ where: { active: true }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    prisma.servicingSchedule.findMany({
      include: { organisation: { select: { companyName: true } } },
      orderBy: [{ organisation: { companyName: "asc" } }, { region: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Client servicing days</h1>
        <p className="text-sm text-dim">
          Configurable per client — and per region, for regional frequency. A client with no schedule here can be
          booked on any day, same as before. Bookings on an unavailable day are rejected unless a back-office user
          provides an authorised override reason.
        </p>
      </div>

      <ServicingScheduleForm organisations={organisations} />

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Min. order</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{s.organisation.companyName}</td>
                <td className="px-4 py-3 text-dim">{s.region || "Default / metro"}</td>
                <td className="px-4 py-3 text-dim">{formatDays(s.daysOfWeek)}</td>
                <td className="px-4 py-3 text-dim">{s.minimumOrderThreshold ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${s.active ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-elevated text-dim"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton endpoint={`/api/servicing/${s.id}`} itemLabel="servicing schedule" />
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No schedules configured yet — every client can be booked on any day.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
