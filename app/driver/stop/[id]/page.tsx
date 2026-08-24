import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StopWorkflow } from "@/components/StopWorkflow";

const FINISHED_STATUSES = ["DELIVERED", "PARTIALLY_DELIVERED", "FAILED", "CANCELLED", "RETURNED"] as const;

export default async function StopPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "DRIVER") redirect("/login");

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: { route: true, proofOfDelivery: true, items: true },
  });

  if (!delivery || delivery.route?.driverId !== session.user.id) notFound();

  const nextDelivery = await prisma.delivery.findFirst({
    where: {
      routeId: delivery.routeId,
      sequence: { gt: delivery.sequence },
      status: { notIn: [...FINISHED_STATUSES] },
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
        specialInstructions: delivery.specialInstructions,
        assemblyRequired: delivery.assemblyRequired,
        packagingRemovalRequired: delivery.packagingRemovalRequired,
        status: delivery.status,
        alreadyCompleted: Boolean(delivery.proofOfDelivery),
        items: delivery.items.map((i) => ({ id: i.id, productDescription: i.productDescription, quantity: i.quantity })),
      }}
      nextDeliveryId={nextDelivery?.id ?? null}
    />
  );
}
