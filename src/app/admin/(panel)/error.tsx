"use client";

import { ErrorView } from "@/components/feedback/error-view";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} homeHref="/admin" homeLabel="Back to the dashboard" />;
}
