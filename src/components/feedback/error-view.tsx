"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";

/**
 * Shared error boundary body. Server errors arrive with a generic message and a digest only,
 * so nothing internal is ever shown; the digest lets support match the redacted server log.
 */
export function ErrorView({ error, retry, homeHref = "/", homeLabel = "Back to the shop" }: { error: unknown; retry: () => void; homeHref?: string; homeLabel?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div role="alert" className="mx-auto flex min-h-[60dvh] max-w-[34rem] flex-col items-center justify-center px-gutter py-16 text-center">
      <p className="text-2xs uppercase tracking-[0.3em] text-subtle">Something went wrong</p>
      <h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-light outline-none sm:text-4xl">
        We couldn&apos;t load this page
      </h1>
      <p className="mt-3 text-muted">Nothing you entered was lost. Try again, and if it keeps happening, contact support with the reference below.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={retry}>
          <RotateCw className="size-4" aria-hidden /> Try again
        </Button>
        <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>
          {homeLabel}
        </Link>
      </div>
      {digest && <p className="mt-6 font-mono text-xs text-subtle">Reference {digest}</p>}
    </div>
  );
}
