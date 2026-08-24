# Deployment guide

This app is a standard Next.js + PostgreSQL application, so it runs on any
host that supports both. Below is a concrete path using **Render** (simple,
free-tier Postgres available, automatic HTTPS on custom domains) as the
default recommendation, plus notes for alternatives.

## 1. Provision a production database

Pick one:

- **Neon** (https://neon.tech) — serverless Postgres, generous free tier, instant provisioning.
- **Render Postgres** — if you're already deploying the app on Render, keep both in the same project.
- **Supabase** — Postgres + built-in dashboard if you want to browse data outside `prisma studio`.

Whichever you choose, copy its connection string — this becomes your
production `DATABASE_URL`. Use a **separate database for staging** so
test data never touches production records (e.g. a second free Neon
branch/project).

## 2. Deploy the app

### Option A — Render (recommended, simplest)

1. Push this repository to GitHub (already done if you're reading this from the repo).
2. In Render: **New → Web Service**, connect the repo.
3. Environment: **Docker** (Render will use the included `Dockerfile`).
4. Set the environment variables listed in step 3 below.
5. Render provisions a `*.onrender.com` HTTPS URL automatically — no
   certificate setup needed. Add your own domain under **Settings → Custom
   Domains** once you own one (step 5).
6. Repeat with a second Render service pointed at a separate branch/database
   for a staging environment.

### Option B — Railway / Fly.io / any Docker host

The included `Dockerfile` builds a self-contained production image
(`docker build -t nexamove .`) that any container host can run — set the
same environment variables and expose port 3000. Most of these platforms
also terminate HTTPS automatically for you.

### Option C — Vercel

Vercel doesn't run the `Dockerfile`; it builds directly from
`package.json` (`npm run build`). This works fine since the app has no
Docker-only dependency — just set the environment variables in the Vercel
project settings. Use an external Postgres (Neon/Supabase) since Vercel
doesn't host Postgres itself. Note: local-disk file storage does **not**
persist on Vercel's serverless runtime — you must configure S3-compatible
storage (step 4) before going live there.

## 3. Set environment variables

On your host's environment-variable settings (never commit these to git):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | From step 1 |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` — a **different** value for staging vs. production |
| `NEXTAUTH_URL` | Yes | The full public URL of this deployment, e.g. `https://app.nexamove.com.au` |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Recommended for production | See step 4 |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Recommended | See step 6 |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional | Live map on the customer tracking page. Without it, tracking still shows a plain-text ETA window from the driver's live GPS. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Optional | Customer SMS (tracking link, delivery confirmation, delivery failure). Without these, every send attempt is still logged to `NotificationLog` with status `NOT_CONFIGURED`. |
| `RESEND_API_KEY`, `NOTIFICATIONS_FROM_EMAIL` | Optional | Same customer notifications, email channel. Verify the sending domain in Resend before this will actually deliver. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional | NexaMove AI (Operations + customer Delivery Assistant). Without it, both show "temporarily unavailable"; everything else works normally. |

See `.env.example` for the full list with inline explanations of what each one degrades to when unset.

## 4. Production file storage (photos & signatures)

Local-disk storage (the default) is fine for a quick trial but is **not
durable** — most hosts wipe the container filesystem on every redeploy,
which would delete delivery photos and signatures. Before going live:

1. Create an S3-compatible bucket. Cheapest/simplest for Australian
   traffic is usually **Cloudflare R2** (no egress fees) or AWS S3
   `ap-southeast-2` (Sydney).
2. Create an access key scoped to that bucket only.
3. Set `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   (and `S3_ENDPOINT` if using R2/B2, `S3_PUBLIC_URL_BASE` if serving
   through a CDN/custom domain in front of the bucket).
4. Redeploy — `lib/storage.ts` automatically switches to S3 once these are
   present; no code changes needed.

## 5. Domain + HTTPS

1. Buy a domain (e.g. via Namecheap, Cloudflare Registrar, or an `.com.au`
   registrar if you want a Queensland-facing local domain).
2. Point its DNS at your host: most hosts (Render, Railway, Vercel) give
   you a CNAME target — add that record with your registrar.
3. Add the domain in your host's dashboard; HTTPS certificates
   (Let's Encrypt) are issued and renewed automatically by all of the hosts
   listed above — no manual certificate management required.
4. Update `NEXTAUTH_URL` to the final `https://` domain and redeploy.

The driver workflow (GPS, camera, signature pad) requires a secure
(`https://`) origin to work on real phones — this is a browser security
requirement, not something this app can bypass, which is exactly why HTTPS
is set up before drivers use it in the field.

## 6. Monitoring & error logging

1. Create a free project at https://sentry.io (Platform: Next.js).
2. Copy its DSN into `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`.
3. Redeploy — `sentry.server.config.ts` / `sentry.client.config.ts` /
   `sentry.edge.config.ts` activate automatically once a DSN is present;
   with no DSN set, they're inert (no error is thrown either way).
4. Point an uptime monitor (Better Uptime, UptimeRobot, or your host's
   built-in health checks) at `GET /api/health` — it returns `200` with
   `{"status":"ok"}` when the app and database are both reachable, and
   `503` otherwise.
5. Application logs are structured JSON on stdout/stderr
   (`lib/logger.ts`) — every major host (Render, Railway, Fly.io, Vercel)
   captures and makes these searchable without extra setup.

## 7. Running database migrations in production

Never run `prisma migrate dev` against production — it can prompt to reset
data. Use:

```bash
npx prisma migrate deploy
```

Run this as a one-off command/release step on your host after each deploy
that changes `prisma/schema.prisma`. On Render/Railway this can be wired
as a "pre-deploy" or "release" command; otherwise run it manually via the
host's shell/SSH access after deploying.

## Staging vs. production checklist

- [ ] Separate database (different `DATABASE_URL`)
- [ ] Separate `NEXTAUTH_SECRET`
- [ ] Separate S3 bucket/prefix (don't mix staging test photos with real customer photos)
- [ ] Staging can share the same Sentry project but should set
      `environment: "staging"` — already handled automatically via
      `NODE_ENV` in the Sentry config files if you deploy staging with
      `NODE_ENV=production` and a distinct `SENTRY_ENVIRONMENT` — or just
      use a second Sentry project for a hard separation.
