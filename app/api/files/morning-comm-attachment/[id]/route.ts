import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { respondWithStoredFile } from "@/lib/fileAccess";

// Back-office only, same reasoning as warehouse audit photos — internal
// operational evidence, not customer or per-tenant data.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const log = await prisma.morningCommunicationLog.findUnique({ where: { id: params.id } });
  if (!log || !log.attachmentUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return respondWithStoredFile(log.attachmentUrl);
}
