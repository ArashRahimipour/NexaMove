import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreateDeliveryForm } from "@/components/CreateDeliveryForm";
import { DELIVERY_STATUS_COLOR, DELIVERY_STATUS_LABEL } from "@/lib/status-workflow";

export default async function RouteDetailPage({ params }: { params: { id: string } }) {
  const route = await prisma.route.findUnique({
    where: { id: params.id },
    include: {
      driver: true,
      deliveries: {
        include: { proofOfDelivery: true, photos: true },
        orderBy: { sequence: "asc" },
      },
    },
  });

  if (!route) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/routes" className="text-sm text-dim">
          ← All routes
        </Link>
        <h1 className="text-2xl font-bold">{route.name}</h1>
        <p className="text-sm text-dim">
          {new Date(route.date).toLocaleDateString("en-AU")} · Driver: {route.driver?.name ?? "Unassigned"}
        </p>
      </div>

      <CreateDeliveryForm routeId={route.id} />

      <div className="space-y-2">
        {route.deliveries.map((d, idx) => (
          <div key={d.id} className="card flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-sm font-semibold text-dim">
                {idx + 1}
              </span>
              <div>
                <p className="font-semibold">{d.customerName}</p>
                <p className="text-sm text-dim">
                  {d.address}, {d.suburb} QLD {d.postcode}
                </p>
                <Link href={`/track/${d.trackingCode}`} className="text-xs text-brand-400 hover:underline">
                  Customer tracking link
                </Link>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DELIVERY_STATUS_COLOR[d.status]}`}>
                {DELIVERY_STATUS_LABEL[d.status]}
              </span>
              <Link href={`/admin/deliveries/${d.id}`} className="text-xs text-brand-400 hover:underline">
                View delivery{d.photos.length > 0 ? ` (${d.photos.length} photo${d.photos.length === 1 ? "" : "s"})` : ""}
              </Link>
            </div>
          </div>
        ))}
        {route.deliveries.length === 0 && (
          <div className="card text-center text-muted">No stops added yet.</div>
        )}
      </div>
    </div>
  );
}
