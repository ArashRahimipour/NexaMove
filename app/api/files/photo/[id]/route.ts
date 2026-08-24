import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDeliveryFile, respondWithStoredFile } from "@/lib/fileAccess";

// Serves a DeliveryPhoto (covers ordinary delivery photos AND damage
// photos, which both live in this table) — never the stored reference
// directly. See lib/fileAccess.ts for the authorisation rule.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();

  const photo = await prisma.deliveryPhoto.findUnique({
    where: { id: params.id },
    include: { delivery: { select: { organisationId: true, route: { select: { driverId: true } } } } },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canAccessDeliveryFile(session, photo.delivery)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return respondWithStoredFile(photo.url);
}
