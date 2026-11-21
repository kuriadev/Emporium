import { Skeleton } from "@/components/ui/bits";

/** Generic storefront skeleton: shaped like a product grid so the layout doesn't jump when data lands. */
export default function StoreLoading() {
  return (
    <div className="mx-auto max-w-[120rem] px-gutter py-8" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-32 rounded-pill" />
      <Skeleton className="mt-3 h-10 w-[min(28rem,80%)] rounded-md" />
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[4/5] w-full rounded-lg" />
            <Skeleton className="mt-3 h-4 w-3/4 rounded-pill" />
            <Skeleton className="mt-2 h-4 w-1/3 rounded-pill" />
          </div>
        ))}
      </div>
    </div>
  );
}
