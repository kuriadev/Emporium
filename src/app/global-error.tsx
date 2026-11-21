"use client";

import "./globals.css";

/** Replaces the root layout when it fails, so it ships its own document and stays dependency-free. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-PH" className="dark">
      <body className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-fg">
        <title>Something went wrong · Emporium</title>
        <main role="alert" className="max-w-[30rem]">
          <h1 className="text-3xl font-light">Emporium is having a moment</h1>
          <p className="mt-3 text-muted">Please try again in a few seconds. Your bag is saved.</p>
          <button type="button" onClick={retry} className="mt-8 min-h-tap rounded-pill bg-fg px-6 text-bg">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
