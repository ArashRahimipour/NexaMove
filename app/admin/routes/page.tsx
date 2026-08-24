import Link from "next/link";
import { Route as RouteIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageRoutes } from "@/lib/permissions";
import { CreateRouteForm } from "@/components/CreateRouteForm";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";

const ROUTE_STATUS_BADGE: Record<string, string> = {
  PLANNED: "bg-elevated text-dim",
  IN_PROGRESS: "bg-[#FFF7ED] text-[#C2410C]",
  COMPLETED: "bg-[#DCFCE7] text-[#16A34A]",
  CANCELLED: "bg-[#FEF2F2] text-[#DC2626]",
};

export default async function RoutesPage() {
  const session = await auth();
  const canDelete = session ? canManageRoutes(session.user.role) : false;
  const [routes, drivers] = await Promise.all([
    prisma.route.findMany({
      include: { driver: true, deliveries: { select: { status: true } } },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.user.findMany({ where: { role: "DRIVER", active: true }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Routes</h1>
        <CreateRouteForm drivers={drivers} />
      </div>
      <div className="space-y-2">
        {routes.map((r) => {
          const completed = r.deliveries.filter((d) => d.status === "DELIVERED" || d.status === "PARTIALLY_DELIVERED").length;
          return (
            <div key={r.id} className="card flex items-center justify-between gap-4">
              <Link href={`/admin/routes/${r.id}`} className="flex-1">
                <p className="font-semibold">{r.name}</p>
                <p className="text-sm text-dim">
                  {new Date(r.date).toLocaleDateString("en-AU")} · {r.driver?.name ?? "Unassigned"}
                </p>
              </Link>
              <p className="text-sm text-dim">
                {completed}/{r.deliveries.length} completed
              </p>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${ROUTE_STATUS_BADGE[r.status]}`}>
                {r.status.replace("_", " ")}
              </span>
              {canDelete && r.status !== "CANCELLED" && (
                <DeleteButton endpoint={`/api/routes/${r.id}`} itemLabel="route" />
              )}
            </div>
          );
        })}
        {routes.length === 0 && (
          <EmptyState
            icon={RouteIcon}
            title="No routes yet"
            description="Create your first route to start assigning drivers and deliveries."
          />
        )}
      </div>
    </div>
  );
}
