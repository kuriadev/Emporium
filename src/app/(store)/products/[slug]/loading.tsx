import { Skeleton } from "@/components/ui/bits";

export default function ProductLoading() {
  return (
    <div className="mx-auto grid max-w-[120rem] gap-8 px-gutter py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" role="status" aria-live="polite">
      <span className="sr-only">Loading product…</span>
      <Skeleton className="aspect-square w-full rounded-lg" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24 rounded-pill" />
        <Skeleton className="h-10 w-4/5 rounded-md" />
        <Skeleton className="h-6 w-32 rounded-pill" />
        <Skeleton className="h-20 w-full rounded-md" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-tap rounded-full" />
          ))}
        </div>
        <Skeleton className="h-14 w-full rounded-pill" />
      </div>
    </div>
  );
}
