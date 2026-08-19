import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [routesToday, activeDrivers, deliveriesToday] = await Promise.all([
    prisma.route.count({ where: { date: { gte: today, lt: tomorrow } } }),
    prisma.user.count({ where: { role: "DRIVER", active: true } }),
    prisma.delivery.findMany({
      where: { route: { date: { gte: today, lt: tomorrow } } },
      select: { status: true },
    }),
  ]);

  const completed = deliveriesToday.filter((d) => d.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Operations overview</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Routes today</p>
          <p className="text-3xl font-bold">{routesToday}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Active drivers</p>
          <p className="text-3xl font-bold">{activeDrivers}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Deliveries completed today</p>
          <p className="text-3xl font-bold">
            {completed}/{deliveriesToday.length}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <Link href="/admin/routes" className="btn-primary">
          Manage routes
        </Link>
        <Link href="/admin/drivers" className="btn-secondary">
          Manage drivers
        </Link>
      </div>
    </div>
  );
}
