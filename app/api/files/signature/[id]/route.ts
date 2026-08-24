import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDeliveryFile, respondWithStoredFile } from "@/lib/fileAccess";

// Serves a ProofOfDelivery's signature image, keyed by the ProofOfDelivery
// id. See lib/fileAccess.ts for the authorisation rule.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();

  const pod = await prisma.proofOfDelivery.findUnique({
    where: { id: params.id },
    include: { delivery: { select: { organisationId: true, route: { select: { driverId: true } } } } },
  });
  if (!pod || !pod.signatureUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canAccessDeliveryFile(session, pod.delivery)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return respondWithStoredFile(pod.signatureUrl);
}
