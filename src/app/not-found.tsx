import type { Metadata } from "next";
import { NotFoundView } from "@/components/feedback/not-found-view";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main id="main">
      <NotFoundView />
    </main>
  );
}
