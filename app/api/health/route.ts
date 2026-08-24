import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Without this, Next statically optimizes this route (no dynamic APIs used)
// and executes GET exactly once at build time, baking that single result
// in forever — an uptime monitor would keep seeing the build-time snapshot,
// never the database's actual current state.
export const dynamic = "force-dynamic";

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
