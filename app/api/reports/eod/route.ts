import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { computeEodReport } from "@/lib/eodReport";
import { toCsv } from "@/lib/csv";

const BACK_OFFICE_ROLES = ["ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE"] as const;

const CSV_COLUMNS = [
  { key: "customerName", label: "Customer" },
  { key: "trackingCode", label: "Tracking code" },
  { key: "externalReference", label: "Reference" },
  { key: "routeName", label: "Route" },
  { key: "driverName", label: "Driver" },
  { key: "vehicleRegistration", label: "Vehicle" },
  { key: "status", label: "Status" },
  { key: "arrivedAt", label: "Arrival time" },
  { key: "deliveredAt", label: "Completion time" },
  { key: "late", label: "Late" },
  { key: "hasPod", label: "POD" },
  { key: "damaged", label: "Damaged" },
  { key: "customerIssues", label: "Customer issues" },
  { key: "returnOutstanding", label: "Return outstanding" },
];

// Retail clients (Koala) always get their own organisation's data only —
// never trusted from a query param. Back-office roles can view any client
// or all of them (no organisationId = every client).
export async function GET(req: Request) {
  const auth = await requireRole(...BACK_OFFICE_ROLES, "RETAIL_CLIENT");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const from = fromStr ? new Date(fromStr) : new Date();
  from.setHours(0, 0, 0, 0);
  const to = toStr ? new Date(toStr) : new Date(from);
  to.setHours(23, 59, 59, 999);

  const organisationId =
    auth.session.user.role === "RETAIL_CLIENT" ? auth.session.user.organisationId ?? "__none__" : searchParams.get("organisationId") ?? undefined;

  const report = await computeEodReport({
    from,
    to,
    routeId: searchParams.get("routeId") ?? undefined,
    driverId: searchParams.get("driverId") ?? undefined,
    vehicleId: searchParams.get("vehicleId") ?? undefined,
    organisationId,
  });

  if (searchParams.get("format") === "csv") {
    const csv = toCsv(
      report.rows.map((r) => ({
        ...r,
        arrivedAt: r.arrivedAt?.toISOString() ?? "",
        deliveredAt: r.deliveredAt?.toISOString() ?? "",
      })),
      CSV_COLUMNS
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="eod-report-${from.toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json(report);
}
