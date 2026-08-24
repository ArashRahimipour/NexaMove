// Next.js instrumentation hook — the recommended place for @sentry/nextjs to
// initialize on both the Node.js server runtime and the Edge (middleware) runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
