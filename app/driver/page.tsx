import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/SignOutButton";
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_COLOR } from "@/lib/status-workflow";

const FINISHED_STATUSES = new Set(["DELIVERED", "PARTIALLY_DELIVERED", "FAILED", "CANCELLED", "RETURNED"]);

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

  const completedCount = route?.deliveries.filter((d) => FINISHED_STATUSES.has(d.status)).length ?? 0;
  const totalCount = route?.deliveries.length ?? 0;

  return (
    <div className="min-h-screen pb-8">
      <header className="sticky top-0 z-10 border-b border-line bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-dim">Today&apos;s route</p>
            <h1 className="text-lg font-bold">{route?.name ?? "No route assigned"}</h1>
          </div>
          <SignOutButton />
        </div>
        {route && (
          <p className="mt-1 text-sm text-dim">
            {completedCount} of {totalCount} stops completed
          </p>
        )}
      </header>

      <main className="mx-auto max-w-lg space-y-3 px-4 py-4">
        {!route && (
          <div className="card text-center text-dim">
            No route is assigned to you for today. Check with your dispatcher.
          </div>
        )}

        {route && (
          <Link href="/driver/load" className="card flex items-center justify-between gap-3 !bg-brand-500/10">
            <div>
              <p className="font-semibold text-ink">📦 Warehouse — scan today&apos;s stops</p>
              <p className="text-sm text-dim">Scan each order as you load it before starting your route.</p>
            </div>
          </Link>
        )}

        {route?.deliveries.map((delivery, idx) => (
          <Link
            key={delivery.id}
            href={`/driver/stop/${delivery.id}`}
            className="card flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-sm font-semibold text-dim">
                {idx + 1}
              </span>
              <div>
                <p className="font-semibold text-ink">{delivery.customerName}</p>
                <p className="text-sm text-dim">
                  {delivery.address}, {delivery.suburb}
                </p>
              </div>
            </div>
            <span
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${DELIVERY_STATUS_COLOR[delivery.status]}`}
            >
              {DELIVERY_STATUS_LABEL[delivery.status]}
            </span>
          </Link>
        ))}
      </main>
    </div>
  );
}
