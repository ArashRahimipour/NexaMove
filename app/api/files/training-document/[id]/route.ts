import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { respondWithStoredFile } from "@/lib/fileAccess";

// Back-office only — internal compliance record, not customer/tenant data.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const training = await prisma.clientDriverTraining.findUnique({ where: { id: params.id } });
  if (!training || !training.documentUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return respondWithStoredFile(training.documentUrl);
}
