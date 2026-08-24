# Local development setup

## Prerequisites

- Node.js 20+
- Docker (for a local Postgres instance) — or any Postgres 14+ you already have running

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

At minimum, set `DATABASE_URL` and `NEXTAUTH_SECRET` (generate one with
`openssl rand -base64 32`). Everything else in `.env.example` is optional
for local development.

## 3. Start Postgres

```bash
docker compose up -d db
```

This starts only the `db` service from `docker-compose.yml` on port 5432
with the credentials already wired into `.env.example`'s default
`DATABASE_URL`. If you already have your own Postgres running locally,
just point `DATABASE_URL` at it instead and skip this step.

## 4. Run migrations

```bash
npx prisma migrate deploy
```

This applies the schema in `prisma/migrations/` to your database. Use
`npx prisma migrate dev` instead if you're actively changing
`prisma/schema.prisma` and want Prisma to generate a new migration file.

## 5. Create the first administrator

```bash
npm run db:seed
```

By default this creates `admin@nexamove.local` / `ChangeMe123!`. Override
with your own values:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' ADMIN_NAME="Your Name" npm run db:seed
```

Sign in and change the password immediately if you used the default.

## 6. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000/login`.

## Testing the driver workflow locally

The driver workflow needs a route assigned to a driver **for today's
date** to show up on `/driver`. As an admin:

1. Go to `/admin/drivers` → **Add driver**.
2. Go to `/admin/routes` → **New route** → set today's date and assign the
   driver you just created.
3. Open the route → **Add delivery stop** with a real or test address.
4. Sign in as the driver (in a different browser or incognito window) and
   the stop will appear on `/driver`.

GPS capture, camera capture, and the signature pad all require a secure
context (`https://`) in most browsers — `localhost` is exempted, so this
works over plain HTTP during local development, but a **staging or
production deployment must be served over HTTPS** for the driver workflow
to function on a phone. See `docs/DEPLOYMENT.md`.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also runs `prisma generate`) |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npx prisma studio` | Browse/edit the database in a GUI |
| `npx prisma migrate dev --name <name>` | Create a new migration after changing the schema |
