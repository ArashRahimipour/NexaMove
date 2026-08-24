// Structured logging for server-side events. Hosting platforms (Render, Railway,
// Fly.io, Vercel) capture stdout/stderr automatically and make it searchable —
// this gives every log line a consistent, greppable shape without extra infra.
type Level = "info" | "warn" | "error";

function log(level: Level, event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => log("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => log("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => log("error", event, data),
};
