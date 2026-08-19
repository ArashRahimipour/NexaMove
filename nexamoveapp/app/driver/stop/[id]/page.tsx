import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StopWorkflow } from "@/components/StopWorkflow";

export default async function StopPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "DRIVER") redirect("/login");

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: { route: true, proofOfDelivery: true },
  });

  if (!delivery || delivery.route?.driverId !== session.user.id) notFound();

  const nextDelivery = await prisma.delivery.findFirst({
    where: {
      routeId: delivery.routeId,
      sequence: { gt: delivery.sequence },
      status: { not: "COMPLETED" },
    },
    orderBy: { sequence: "asc" },
  });

  return (
    <StopWorkflow
      delivery={{
        id: delivery.id,
        customerName: delivery.customerName,
        customerPhone: delivery.customerPhone,
        address: delivery.address,
        suburb: delivery.suburb,
        postcode: delivery.postcode,
        lat: delivery.lat,
        lng: delivery.lng,
        notes: delivery.notes,
        status: delivery.status,
        alreadyCompleted: Boolean(delivery.proofOfDelivery),
      }}
      nextDeliveryId={nextDelivery?.id ?? null}
    />
  );
}
