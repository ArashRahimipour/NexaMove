"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-elevated px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-dim">
            The error has been logged. Please try again, or contact your dispatcher if this
            continues.
          </p>
          <button
            onClick={reset}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
