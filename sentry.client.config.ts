// Error monitoring — only activates when NEXT_PUBLIC_SENTRY_DSN is set.
// See docs/DEPLOYMENT.md for how to create a free Sentry project and set this.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  });
}
