import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { respondWithStoredFile } from "@/lib/fileAccess";

// Warehouse audit photos are internal compliance evidence, not
// client/customer data — back office only, no per-organisation or
// per-driver access needed (unlike delivery photos in app/api/files/photo).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const item = await prisma.warehouseAuditItem.findUnique({ where: { id: params.id } });
  if (!item || !item.photoUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return respondWithStoredFile(item.photoUrl);
}
