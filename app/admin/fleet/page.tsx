import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageDrivers } from "@/lib/permissions";
import { FleetApprovalPanel } from "@/components/FleetApprovalPanel";

export default async function FleetPage({ searchParams }: { searchParams: { org?: string } }) {
  const session = await auth();
  if (!session || !canManageDrivers(session.user.role)) redirect("/login");

  const organisations = await prisma.organisation.findMany({
    where: { active: true },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });
  const organisationId = searchParams.org ?? organisations[0]?.id;

  const [drivers, vehicles, driverApprovals, vehicleApprovals, trainings] = organisationId
    ? await Promise.all([
        prisma.user.findMany({ where: { role: "DRIVER", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.vehicle.findMany({ where: { active: true }, orderBy: { registration: "asc" }, select: { id: true, registration: true } }),
        prisma.clientDriverApproval.findMany({ where: { organisationId }, include: { driver: { select: { name: true } } } }),
        prisma.clientVehicleApproval.findMany({ where: { organisationId }, include: { vehicle: { select: { registration: true } } } }),
        prisma.clientDriverTraining.findMany({
          where: { organisationId },
          include: { driver: { select: { name: true } } },
          orderBy: { completedAt: "desc" },
        }),
      ])
    : [[], [], [], [], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dedicated fleet &amp; training</h1>
        <p className="text-sm text-dim">
          Per-client driver/vehicle approval and product/competency training — never a global flag, since the same
          driver or vehicle can be approved for one client and not another.
        </p>
      </div>

      <form method="get" className="flex items-end gap-2">
        <div>
          <label className="field-label">Client</label>
          <select name="org" defaultValue={organisationId} className="field-input">
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.companyName}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Switch
        </button>
      </form>

      {organisationId && (
        <FleetApprovalPanel
          organisationId={organisationId}
          drivers={drivers}
          vehicles={vehicles}
          driverApprovals={driverApprovals}
          vehicleApprovals={vehicleApprovals}
          trainings={trainings.map((t) => ({ ...t, completedAt: t.completedAt.toISOString(), expiresAt: t.expiresAt?.toISOString() ?? null }))}
        />
      )}
    </div>
  );
}
