import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

const EVENT_LABEL: Record<string, string> = {
  ASSIGNED: "Order assigned to a driver",
  EN_ROUTE: "Driver en route",
  ARRIVED: "Driver arrived at address",
  PHOTO_CAPTURED: "Delivery photo captured",
  SIGNATURE_CAPTURED: "Signature captured",
  DAMAGE_NOTED: "Damage noted on arrival",
  COMPLETED: "Delivery completed",
  FAILED: "Delivery attempt failed",
};

export default async function TrackingPage({ params }: { params: { code: string } }) {
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode: params.code },
    include: {
      trackingEvents: { orderBy: { createdAt: "asc" } },
      proofOfDelivery: true,
    },
  });

  if (!delivery) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <h1 className="text-xl font-bold text-brand-700">NexaMove tracking</h1>
      <p className="mt-1 text-sm text-slate-500">
        Delivery to {delivery.suburb} QLD {delivery.postcode}
      </p>

      <div className="card mt-4">
        <p className="text-sm text-slate-500">Status</p>
        <p className="text-2xl font-bold">{delivery.status.replace("_", " ")}</p>
      </div>

      <ol className="mt-6 space-y-4 border-l-2 border-slate-200 pl-4">
        {delivery.trackingEvents.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-brand-600" />
            <p className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</p>
            <p className="text-xs text-slate-500">
              {new Date(e.createdAt).toLocaleString("en-AU")}
            </p>
          </li>
        ))}
        {delivery.trackingEvents.length === 0 && (
          <li className="text-sm text-slate-400">No tracking events yet.</li>
        )}
      </ol>

      {delivery.proofOfDelivery && (
        <div className="card mt-6 space-y-2">
          <h2 className="font-semibold">Proof of delivery</h2>
          <p className="text-sm text-slate-600">
            Received by <strong>{delivery.proofOfDelivery.receiverName}</strong> on{" "}
            {new Date(delivery.proofOfDelivery.capturedAt).toLocaleString("en-AU")}
          </p>
          {delivery.proofOfDelivery.hasDamage && (
            <p className="text-sm font-medium text-amber-700">Damage was noted on arrival.</p>
          )}
        </div>
      )}
    </div>
  );
}
