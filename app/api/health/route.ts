import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", time: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { status: "error", db: "down", message: err instanceof Error ? err.message : "unknown" },
      { status: 503 }
    );
  }
}
