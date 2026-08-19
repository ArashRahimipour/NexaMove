import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CreateRouteForm } from "@/components/CreateRouteForm";

export default async function RoutesPage() {
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
          const completed = r.deliveries.filter((d) => d.status === "COMPLETED").length;
          return (
            <Link key={r.id} href={`/admin/routes/${r.id}`} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-sm text-slate-500">
                  {new Date(r.date).toLocaleDateString("en-AU")} · {r.driver?.name ?? "Unassigned"}
                </p>
              </div>
              <p className="text-sm text-slate-500">
                {completed}/{r.deliveries.length} completed
              </p>
            </Link>
          );
        })}
        {routes.length === 0 && (
          <div className="card text-center text-slate-400">No routes yet — create one to get started.</div>
        )}
      </div>
    </div>
  );
}
