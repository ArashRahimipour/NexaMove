import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const runsheetImport = await prisma.runsheetImport.findUnique({
    where: { id: params.id },
    include: {
      organisation: { select: { companyName: true } },
      importedBy: { select: { name: true } },
      rows: {
        include: {
          delivery: { select: { trackingCode: true, customerName: true, totalCharge: true, status: true } },
          resolvedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!runsheetImport) return NextResponse.json({ error: "Runsheet import not found" }, { status: 404 });
  return NextResponse.json({ runsheetImport });
}
