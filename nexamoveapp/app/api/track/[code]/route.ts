import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode: params.code },
    select: {
      status: true,
      customerName: true,
      suburb: true,
      postcode: true,
      trackingEvents: {
        orderBy: { createdAt: "asc" },
        select: { type: true, createdAt: true, note: true },
      },
      proofOfDelivery: {
        select: {
          receiverName: true,
          hasDamage: true,
          capturedAt: true,
          photoUrl: true,
          signatureUrl: true,
        },
      },
    },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Tracking code not found" }, { status: 404 });
  }

  return NextResponse.json({ delivery });
}
