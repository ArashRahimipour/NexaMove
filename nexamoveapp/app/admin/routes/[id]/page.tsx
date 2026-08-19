import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreateDeliveryForm } from "@/components/CreateDeliveryForm";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  ASSIGNED: "bg-blue-100 text-blue-700",
  EN_ROUTE: "bg-amber-100 text-amber-700",
  ARRIVED: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export default async function RouteDetailPage({ params }: { params: { id: string } }) {
  const route = await prisma.route.findUnique({
    where: { id: params.id },
    include: {
      driver: true,
      deliveries: {
        include: { proofOfDelivery: true },
        orderBy: { sequence: "asc" },
      },
    },
  });

  if (!route) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/routes" className="text-sm text-slate-500">
          ← All routes
        </Link>
        <h1 className="text-2xl font-bold">{route.name}</h1>
        <p className="text-sm text-slate-500">
          {new Date(route.date).toLocaleDateString("en-AU")} · Driver: {route.driver?.name ?? "Unassigned"}
        </p>
      </div>

      <CreateDeliveryForm routeId={route.id} />

      <div className="space-y-2">
        {route.deliveries.map((d, idx) => (
          <div key={d.id} className="card flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                {idx + 1}
              </span>
              <div>
                <p className="font-semibold">{d.customerName}</p>
                <p className="text-sm text-slate-500">
                  {d.address}, {d.suburb} QLD {d.postcode}
                </p>
                <Link href={`/track/${d.trackingCode}`} className="text-xs text-brand-600 hover:underline">
                  Customer tracking link
                </Link>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[d.status]}`}>
                {d.status.replace("_", " ")}
              </span>
              {d.proofOfDelivery && (
                <a
                  href={d.proofOfDelivery.photoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-600 hover:underline"
                >
                  View ePOD photo
                </a>
              )}
            </div>
          </div>
        ))}
        {route.deliveries.length === 0 && (
          <div className="card text-center text-slate-400">No stops added yet.</div>
        )}
      </div>
    </div>
  );
}
