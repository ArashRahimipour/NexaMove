# Database schema

Full source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma).
Migrations live in [`prisma/migrations/`](../prisma/migrations/) and are
plain SQL — reviewable, and applied with `npx prisma migrate deploy`.

## Core entities

- **User** — one row per real person with login access. `role` is one of
  `ADMIN`, `OPERATIONS_MANAGER`, `DISPATCHER`, `CUSTOMER_SERVICE`, `DRIVER`,
  `RETAIL_CLIENT`. A `RETAIL_CLIENT` user is scoped to one `Organisation`
  via `organisationId` — see `lib/permissions.ts` for what each role can
  see/do, enforced server-side, never just hidden in the UI.
- **Organisation** — a retail client company. Deliveries and users can be
  scoped to one; a retail client can only ever see their own organisation's
  data (verified in `app/api/deliveries/route.ts` and
  `app/admin/deliveries/[id]/page.tsx`).
- **Driver** — extends a `User` (role `DRIVER`) with licence, vehicle,
  payment split, and rating.
- **Vehicle** — registration, capacity (CBM/weight), compliance dates.
- **Route** — a driver's set of stops for a given date, with a vehicle and
  region.
- **Delivery** — one stop: customer, address, items, pricing, and a full
  status lifecycle (see below) plus a unique public `trackingCode`.
- **DeliveryItem** — line items on a delivery, each with its own
  `itemStatus` for partial-delivery support.
- **DeliveryPhoto** — every photo captured (delivery, damage, or failed
  attempt), categorised, with GPS and uploader.
- **TrackingEvent** — an immutable, timestamped log entry for a delivery,
  with old/new status, GPS, and the user who triggered it. Never
  overwritten, only appended — this is the record a dispute would be
  resolved from.
- **ProofOfDelivery** — signature, receiver, contactless/exception
  handling, assembly/packaging completion, and geofence verification
  result. One-to-one with a `Delivery`.
- **DamageReport** — discovery stage, reason, description, photos, and a
  `responsibility` that always starts `UNDETERMINED`; only Operations/Admin
  can set it afterwards (`PATCH /api/deliveries/[id]/damage`), and that
  change is written to `AuditLog`.
- **FailedDeliveryReport** — reason, notes, GPS, evidence photo.
- **CustomerServiceCase** / **CaseNote** — support cases opened against a
  delivery.
- **Alert** — operational alerts (damage, failed delivery, capacity
  exceeded, etc.) with acknowledge/resolve tracking.
- **CustomerRating** — post-delivery star rating.
- **Settlement** — a driver's pay period, computed once from actual
  per-delivery charges (never a flat assumed rate) and never silently
  recomputed after creation — only its `status` changes as it moves
  Draft → Review → Approved → Paid.
- **AuditLog** — append-only record of every significant write (status
  changes, damage responsibility, settlement approval, settings changes),
  with before/after values.
- **AppSettings** — singleton row of admin-configurable settings (geofence
  radius, photo/signature requirements, default driver split, regions).
- **NotificationLog** — schema-ready for Phase 4 (SMS/email); stays empty
  until a provider is configured.

## The delivery status state machine

`lib/status-workflow.ts` defines which status transitions are legal (e.g. a
delivery can't jump from `ASSIGNED` straight to `DELIVERED`) and is
enforced in every API route that changes status — not just in the UI. The
key business rule this protects: **`ARRIVED` is always a separate, required
step before `DELIVERED`** — pressing "I've arrived" never completes a
delivery by itself.

## Why an event log instead of just status fields

`Delivery.status` gives you the current state at a glance, but
`TrackingEvent` gives you the full history — when the driver arrived, what
time the photo was taken, what GPS coordinates were captured at each step.
This is what the customer tracking page renders, and it's the record
you'd hand over if a delivery were ever disputed.

## Adding a migration

```bash
# after editing prisma/schema.prisma:
npx prisma migrate dev --name describe_your_change
```

This creates a new folder under `prisma/migrations/` with plain SQL — commit
it. In production, `npx prisma migrate deploy` applies any migrations that
haven't run yet, in order, without prompting.
