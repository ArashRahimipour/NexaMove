import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDeliveryFile, respondWithStoredFile } from "@/lib/fileAccess";

// Serves a FailedDeliveryReport's evidence photo, keyed by the report id.
// See lib/fileAccess.ts for the authorisation rule.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();

  const report = await prisma.failedDeliveryReport.findUnique({
    where: { id: params.id },
    include: { delivery: { select: { organisationId: true, route: { select: { driverId: true } } } } },
  });
  if (!report || !report.photoUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canAccessDeliveryFile(session, report.delivery)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return respondWithStoredFile(report.photoUrl);
}
