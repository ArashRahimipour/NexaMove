# NexaMove

A real logistics platform for operating live delivery rounds in Queensland —
real users, real database records, real timestamps, real GPS, real photos,
and real proof-of-delivery, not a mockup.

Built with Next.js (App Router, TypeScript), PostgreSQL via Prisma, and
NextAuth. Every primary action in the app is wired to a real API endpoint
and a real database write — there is no placeholder or "fake" data path.

## What's included

- **Real authentication, six roles** — Admin, Operations Manager,
  Dispatcher, Customer Service, Driver, Retail Client. Bcrypt-hashed
  passwords, session-based role checks enforced in middleware *and* every
  API route (never trusted from the browser alone).
- **Driver workflow** (mobile-first): Navigate → I've arrived (GPS +
  geofence check) → Photos (multi-photo, categorised) → Signature/Receiver
  → Assembly/packaging checklist → Damage check → Item-by-item partial
  delivery → Complete → ePOD → Next stop. A **Report a delivery problem**
  path is available at any point for a failed delivery, with reason codes
  and required evidence photos for high-risk reasons.
- **Full delivery status state machine** (19 states) — a driver can't jump
  straight from Assigned to Delivered; every transition is validated
  server-side and logged as an immutable tracking event.
- **Damage workflow** — driver reports discovery stage, reason, description
  and photos; responsibility always starts **Undetermined** and can only be
  set afterwards by Operations/Admin, with the change audited.
- **Multi-tenant retail client portal** (`/client`) — retail clients submit
  and track only their own organisation's deliveries; verified isolated
  from other organisations at the UI, API, and direct-URL level.
- **Dispatch** — assign unassigned deliveries to a driver with vehicle
  CBM/weight capacity checking (warns and requires override, doesn't
  silently over-allocate).
- **KPI dashboard** — DIFOT, completion/failed/damage rates, CBM, revenue,
  driver cost, company retained — computed from real records for a
  selectable date range, not hardcoded numbers.
- **Customer service, alerts, settlements, audit log, admin settings** —
  see `docs/SCHEMA.md` for the full model list.
- **Public customer tracking page** — a unique link per delivery
  (`/track/<code>`) showing the real tracking event timeline, no login
  required.
- **Pluggable file storage** — local disk for development, S3-compatible
  (AWS S3 / Cloudflare R2 / Backblaze B2) for production via environment
  variables.
- **Error monitoring** — optional Sentry integration (env-gated) plus a
  `/api/health` endpoint for uptime checks.

## Quick start (local development)

```bash
cp .env.example .env
docker compose up --build -d db      # Postgres only
npm install
npx prisma migrate deploy
npm run db:seed                      # creates the first admin user
npm run dev
```

Sign in at `http://localhost:3000/login` with the admin account printed by
`db:seed` (defaults to `admin@nexamove.local` / `ChangeMe123!` unless you
set `ADMIN_EMAIL`/`ADMIN_PASSWORD` — change the password immediately after
first login).

See [`docs/SETUP.md`](docs/SETUP.md) for full local setup,
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for taking this to a real
production/staging host with HTTPS and a custom domain, and
[`docs/ADMIN_SETUP.md`](docs/ADMIN_SETUP.md) for day-one operator tasks
(creating drivers, building the first route, onboarding a retail client).

## Every visible primary button either works or explains why not

Every primary button in this app calls a real API route that reads or
writes real database records — there are no decorative buttons wired to
nothing. Where a capability genuinely isn't available yet (e.g. GPS
permission denied, camera unavailable), the UI shows the specific error
inline rather than silently failing or faking success.

## Project structure

```
app/                Next.js App Router pages + API routes
  admin/             Back-office: routes, drivers, vehicles, dispatch, KPI,
                      alerts, customer service, settlements, retail clients,
                      audit log, settings
  driver/             Driver mobile workflow
  client/             Retail client portal
  track/[code]/       Public customer tracking page
  api/                 REST-style route handlers
components/          Shared client components (SignaturePad, forms, etc.)
lib/                 Auth, Prisma client, storage abstraction, permissions,
                      status-workflow state machine, geofence, audit log
prisma/              Database schema, migrations, seed script
docs/                Setup, deployment, schema, and admin documentation
```

## Scope and honesty about what's real vs. what you still need to provision

This repository is a fully working application — auth, database, the full
delivery status workflow, driver GPS/photo/signature/damage/partial/failed
capture, admin tools, retail client portal, KPI dashboard, and customer
tracking all function against a real Postgres database with real records,
verified end-to-end. What it does **not** do for you, because they require
your own paid accounts and cannot be provisioned by an agent on your
behalf, are:

- Registering a real domain name and pointing its DNS at your host
- Creating your production database instance (Neon/Supabase/Railway/RDS/etc.)
- Creating a Sentry account/project for error monitoring
- Creating accounts with a hosting provider (Render/Railway/Fly.io/Vercel/etc.)
- **Google Maps Platform, SMS (e.g. Twilio), and email (e.g. Resend) API
  keys** — until these are configured, live map view, automated SMS/email
  notifications, and precise route optimisation stay switched off rather
  than faked. Navigation still works via a plain Google Maps deep link
  (no API key required for that).
- **An `OPENAI_API_KEY`** — until set, "NexaMove AI" (the internal
  Operations AI at `/admin/ai` and the customer Delivery Assistant on the
  tracking page) shows "AI Assistant is temporarily unavailable" instead of
  a chat box. Every other page and workflow keeps working exactly as before
  — the AI layer is additive, not a dependency. See "NexaMove AI" below.

`docs/DEPLOYMENT.md` walks through each of these steps concretely.

## NexaMove AI

Two chat assistants, both backed by OpenAI through a controlled server-side
tool layer — the model never touches the database directly.

- **Operations AI** (`/admin/ai`, all back-office roles) — answers
  questions about today's deliveries, delays, failures, damage, driver/
  vehicle compliance, KPIs, and settlements using ~18 read-only tools
  (`lib/ai/operationsTools.ts`), each independently role-gated. It can also
  open a customer service case. A rule-based priority summary (critical /
  needs attention) is computed with plain database queries — no OpenAI call
  — so the dashboard AI card and the top of the AI page are free and instant;
  OpenAI is only called when someone actually sends a chat message.
- **Customer AI** ("NexaMove Delivery Assistant" on `/track/<code>`) — scoped
  to exactly one delivery, chosen server-side from the tracking code the
  model never sees or controls. It can report status and open a customer
  service case, and nothing else — no driver personal data, costs, payments,
  settlements, or other customers' information is reachable from this
  surface even in principle, because those tools simply don't exist in its
  tool list (`lib/ai/customerTools.ts`).

Every AI turn — including failures — is logged to `AiActivityLog`
(`lib/ai/audit.ts`), separate from the main `AuditLog`, with the request,
a short result summary, which tools were called, and token usage. Both chat
routes are rate-limited (`lib/ai/rateLimit.ts`, DB-backed so it survives
serverless cold starts) and instruct the model to treat all delivery/customer
data as untrusted content, never as instructions (prompt-injection
mitigation) — see the system prompts in `lib/ai/prompts.ts`.
