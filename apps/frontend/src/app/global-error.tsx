"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
          <h1 className="text-4xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">An unexpected error occurred</p>
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
