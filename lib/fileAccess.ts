import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { resolveStoredFile } from "@/lib/storage";

const BACK_OFFICE_ROLES = ["ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE"];

// Shared authorisation rule for every delivery-owned file (photo, signature,
// failed-delivery evidence) — back office sees everything, a driver only
// their own route's deliveries, a retail client only their own
// organisation's. No session at all is always denied: the public tracking
// page doesn't currently render any of these files, so there's no
// legitimate unauthenticated caller yet — if that changes, it should mint a
// scoped token tied to the tracking code rather than opening this up.
export function canAccessDeliveryFile(
  session: Session | null,
  delivery: { organisationId: string | null; route: { driverId: string | null } | null }
): boolean {
  if (!session) return false;
  const role = session.user.role;
  if (BACK_OFFICE_ROLES.includes(role)) return true;
  if (role === "DRIVER") return delivery.route?.driverId === session.user.id;
  if (role === "RETAIL_CLIENT") return delivery.organisationId != null && delivery.organisationId === session.user.organisationId;
  return false;
}

// Resolves a stored file reference into an actual HTTP response — a redirect
// to a freshly-generated short-lived signed URL (S3) or a legacy public URL,
// or the file bytes streamed directly (local disk). Only call this after
// canAccessDeliveryFile has already confirmed the requester may see it.
export async function respondWithStoredFile(reference: string): Promise<NextResponse> {
  const resolved = await resolveStoredFile(reference);
  if (resolved.kind === "redirect") {
    return NextResponse.redirect(resolved.url);
  }
  return new NextResponse(new Uint8Array(resolved.buffer), {
    headers: {
      "Content-Type": resolved.contentType,
      // Private: this response is specific to the authorised requester,
      // never a shared/public cache.
      "Cache-Control": "private, max-age=60",
    },
  });
}
