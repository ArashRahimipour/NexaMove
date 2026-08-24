# Administrator setup

Day-one tasks for the person operating NexaMove for a real delivery
business.

## 1. First login

After running `npm run db:seed` (or your host's equivalent one-off
command), sign in at `/login` with the admin account it created. **Change
the password immediately** — there is currently no self-service
"change password" screen, so do this by re-running the seed with a new
`ADMIN_PASSWORD`, or by updating the `users` table directly:

```bash
# Generate a new bcrypt hash, then update the row:
node -e "console.log(require('bcryptjs').hashSync('YourNewStrongPassword!', 12))"
```

```sql
UPDATE users SET "passwordHash" = '<hash from above>' WHERE email = 'admin@nexamove.local';
```

## 2. Create additional admins/operations/customer service accounts

There is no UI for this yet for non-driver, non-retail-client roles.
Create them directly in the database:

```sql
INSERT INTO users (id, email, name, "passwordHash", role, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'ops@yourcompany.com.au',
  'Ops Manager Name',
  '<bcrypt hash — generate as above>',
  'OPERATIONS_MANAGER', -- or 'ADMIN', 'DISPATCHER', 'CUSTOMER_SERVICE'
  true, now(), now()
);
```

## 3. Add your drivers and vehicles

- `/admin/vehicles` → **Add vehicle** — registration, type, CBM/weight capacity.
- `/admin/drivers` → **Add driver** — email + temporary password (share it
  securely, not over plain SMS if avoidable), licence number/expiry, and
  payment split %.

## 4. Onboard a retail client (optional)

`/admin/organisations` → **Add retail client** — company details plus an
optional portal login (email + temporary password). That login lands them
on `/client`, where they can submit and track only their own deliveries —
verified isolated from every other retail client's data.

## 5. Build a route and assign deliveries

`/admin/routes` → **New route**, set today's (or a future) date and assign
a driver. Open the route → **Add delivery stop** for each customer address
— optionally add line items, mark assembly/packaging-removal required.
Each stop gets its own tracking code immediately, visible via "Customer
tracking link" — send that link to the customer however you already
communicate with them.

Deliveries submitted by a retail client (or created without a route) show
up unassigned on **`/admin/dispatch`**, where you assign them to a driver
— capacity against that driver's vehicle is checked automatically.

## 6. Monitor deliveries live

- `/admin/routes/<id>` — every stop's current status and a link into its
  full detail page (photos, signature, damage reports, tracking timeline).
- `/admin/deliveries/<id>` — the central record for one delivery: proof of
  delivery, all photos in a gallery, damage reports (assign responsibility
  here — starts Undetermined, only Admin/Ops can set it), failed-delivery
  reports, tracking timeline, and customer service cases.
- `/admin/alerts` — damage reports and failed deliveries raise alerts here
  automatically; acknowledge/resolve them.
- `/admin/kpi` — real, date-range-filterable stats (DIFOT, completion rate,
  damage %, revenue, driver cost) computed from actual records.
- `/admin/customer-service` — search by delivery ID, customer, phone, or
  reference; see open cases.
- `/admin/settlements` — generate a driver's pay period from their actual
  completed-delivery charges, then move it Draft → Review → Approved → Paid.
- `/admin/audit` — append-only log of status changes, damage responsibility
  assignments, settlement approvals, and settings changes.
- `/admin/settings` — company details, geofence radius, photo/signature
  requirements, default driver split.

Pages refresh on load, not live via websockets — reload to see the latest
status.

## Known limitations to plan around

This is a real, working platform — not a finished commercial product.
Before relying on it for high-volume operations, be aware:

- **No self-service password reset / change-password UI** — see step 1.
- **No route optimisation or drag-to-reorder stops** — stops are delivered
  in the order you add them.
- **Customer SMS/email and the live tracking map need a paid provider key**
  — the app sends tracking-link/confirmation/failure texts and emails, and
  shows a live map with ETA on the customer tracking page, but only once
  you set `TWILIO_*`, `RESEND_API_KEY`, and
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (billing required with each provider —
  see `docs/DEPLOYMENT.md`). Without them: no text/email is sent (every
  attempt is still logged), and tracking shows a plain-text ETA window
  with no map. ETA itself is a heuristic (average speed + a road-distance
  factor), not turn-by-turn routing. Driver navigation still works via a
  plain Google Maps deep link with no key needed.
- **Admin dashboard refreshes on page load**, not live via websockets.
  Live driver GPS is tracked and polled by the customer tracking page
  every 15 seconds, but internal admin views (routes, dispatch) don't
  auto-refresh.
- **Runsheet reconciliation matching is exact-only** (`/admin/runsheets`)
  — a row that doesn't exactly match a delivery's tracking code, external
  reference, or name+postcode is left `UNMATCHED` for manual review rather
  than guessed.

None of these are stubbed-out buttons — they're simply not built yet, or
are explicitly blocked on you providing a paid third-party API key. If you
need them, they're natural next additions on top of this schema.
