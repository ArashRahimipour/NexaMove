import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/SignOutButton";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  EN_ROUTE: "En route",
  ARRIVED: "Arrived",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  ASSIGNED: "bg-blue-100 text-blue-700",
  EN_ROUTE: "bg-amber-100 text-amber-700",
  ARRIVED: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export default async function DriverHomePage() {
  const session = await auth();
  if (!session || session.user.role !== "DRIVER") redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const route = await prisma.route.findFirst({
    where: { driverId: session.user.id, date: { gte: today, lt: tomorrow } },
    include: {
      deliveries: { orderBy: { sequence: "asc" } },
    },
  });

  const completedCount = route?.deliveries.filter((d) => d.status === "COMPLETED").length ?? 0;
  const totalCount = route?.deliveries.length ?? 0;

  return (
    <div className="min-h-screen pb-8">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Today&apos;s route</p>
            <h1 className="text-lg font-bold">{route?.name ?? "No route assigned"}</h1>
          </div>
          <SignOutButton />
        </div>
        {route && (
          <p className="mt-1 text-sm text-slate-500">
            {completedCount} of {totalCount} stops completed
          </p>
        )}
      </header>

      <main className="mx-auto max-w-lg space-y-3 px-4 py-4">
        {!route && (
          <div className="card text-center text-slate-500">
            No route is assigned to you for today. Check with your dispatcher.
          </div>
        )}

        {route?.deliveries.map((delivery, idx) => (
          <Link
            key={delivery.id}
            href={`/driver/stop/${delivery.id}`}
            className="card flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                {idx + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{delivery.customerName}</p>
                <p className="text-sm text-slate-500">
                  {delivery.address}, {delivery.suburb}
                </p>
              </div>
            </div>
            <span
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[delivery.status]}`}
            >
              {STATUS_LABEL[delivery.status]}
            </span>
          </Link>
        ))}
      </main>
    </div>
  );
}
