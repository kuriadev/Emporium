"use client";

import { ErrorView } from "@/components/feedback/error-view";

export default function StoreError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
