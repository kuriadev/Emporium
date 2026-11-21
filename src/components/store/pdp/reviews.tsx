"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, MessageSquarePlus, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { BotGuard, Stars } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatDate } from "@/lib/money";
import { cn } from "@/lib/utils";
import { reviewSchema } from "@/lib/validations/commerce";
import { submitReviewAction } from "@/server/actions/shop";

export interface ReviewView {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  createdAt: number;
}

export type ReviewEligibility = "eligible" | "signed-out" | "not-purchased" | "already-reviewed" | "staff";

export function Reviews({
  productId,
  slug,
  average,
  count,
  histogram,
  reviews,
  eligibility,
}: {
  productId: string;
  slug: string;
  average: number;
  count: number;
  histogram: { rating: number; count: number }[];
  reviews: ReviewView[];
  eligibility: ReviewEligibility;
}) {
  const [filter, setFilter] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [writing, setWriting] = useState(false);
  const shown = reviews.filter((r) => (filter ? r.rating === filter : true) && (verifiedOnly ? r.verified : true));
  const max = Math.max(1, ...histogram.map((h) => h.count));

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="reviews-title" className="text-2xl font-medium">
          Reviews <span className="font-light text-muted">from people who bought it.</span>
        </h2>
        {eligibility === "eligible" && !writing && (
          <Button variant="outline" onClick={() => setWriting(true)}>
            <MessageSquarePlus className="size-4" aria-hidden /> Write a review
          </Button>
        )}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <p className="text-display font-light leading-none">{count ? average.toFixed(1) : "–"}</p>
            <div>
              <Stars value={average} size="md" />
              <p className="mt-1 text-sm text-muted">
                {count} {count === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
          <ul className="space-y-1" aria-label="Filter by rating">
            {histogram.map((h) => {
              const on = filter === h.rating;
              return (
                <li key={h.rating}>
                  <button
                    type="button"
                    disabled={h.count === 0}
                    aria-pressed={on}
                    onClick={() => setFilter(on ? null : h.rating)}
                    className={cn("grid min-h-tap w-full grid-cols-[2.5rem_1fr_2rem] items-center gap-3 rounded-sm px-2 text-sm transition disabled:opacity-40", on ? "bg-white/10" : "hover:bg-white/5")}
                  >
                    <span className="flex items-center gap-1">
                      {h.rating} <Star className="size-3.5 fill-warning text-warning" aria-hidden />
                    </span>
                    <span className="h-2 overflow-hidden rounded-pill bg-surface-2">
                      <motion.span className="block h-full rounded-pill bg-warning" initial={{ width: 0 }} whileInView={{ width: `${(h.count / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.6, ease: "easeOut" }} />
                    </span>
                    <span className="text-right tabular-nums text-muted">{h.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="flex min-h-tap cursor-pointer items-center gap-3 px-2 text-sm">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="size-4 accent-[var(--color-price)]" />
            Verified buyers only
          </label>
          <EligibilityNote eligibility={eligibility} slug={slug} />
        </div>

        <div className="space-y-6">
          <AnimatePresence>{writing && <ReviewForm productId={productId} onDone={() => setWriting(false)} />}</AnimatePresence>
          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">{count === 0 ? "No reviews yet. Verified buyers can be the first." : "No reviews match this filter."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((r) => (
                <motion.li key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 py-6 first:pt-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} />
                    <p className="font-medium">{r.title}</p>
                  </div>
                  <p className="whitespace-pre-line text-muted">{r.body}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                    <span>{r.authorName}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={new Date(r.createdAt).toISOString()}>{formatDate(r.createdAt)}</time>
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 text-success">
                        <BadgeCheck className="size-3.5" aria-hidden /> Verified buyer
                      </span>
                    )}
                  </p>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function EligibilityNote({ eligibility, slug }: { eligibility: ReviewEligibility; slug: string }) {
  const note: Record<Exclude<ReviewEligibility, "eligible">, React.ReactNode> = {
    "signed-out": (
      <>
        Bought this?{" "}
        <Link href={`/login?next=${encodeURIComponent(`/products/${slug}#reviews`)}`} className="text-accent underline underline-offset-4">
          Sign in
        </Link>{" "}
        to leave a verified review.
      </>
    ),
    "not-purchased": "Reviews are open to customers once their order is delivered. It keeps every review honest.",
    "already-reviewed": "Thanks, you've already reviewed this product.",
    staff: "Staff accounts can't post reviews.",
  };
  if (eligibility === "eligible") return null;
  return <p className="rounded-md bg-surface/60 p-3 text-xs text-muted">{note[eligibility]}</p>;
}

const formSchema = reviewSchema.omit({ productId: true, company: true, startedAt: true });
type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

function ReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const router = useRouter();
  const [hover, setHover] = useState(0);
  const guard = useForm<{ company: string; startedAt: number }>({ defaultValues: { company: "", startedAt: 0 } });
  useEffect(() => guard.setValue("startedAt", Date.now()), [guard]);
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    defaultValues: { rating: 5, title: "Exactly as described", body: "Arrived quickly and well packed. The quality is better than I expected for the price, and it looks great in person." },
    mode: "onTouched",
  });
  const { errors, isSubmitting, submitCount, dirtyFields } = form.formState;

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      noValidate
      className="relative space-y-4 overflow-hidden rounded-lg border border-line bg-surface/60 p-5"
      onSubmit={form.handleSubmit(async (data) => {
        const res = await submitReviewAction({ ...data, productId, ...guard.getValues() });
        if (!res.ok) {
          toast.error(res.error);
          if (res.fieldErrors) for (const [k, v] of Object.entries(res.fieldErrors)) form.setError(k as keyof FormIn, { message: v });
          return;
        }
        toast.success(res.message ?? "Review posted");
        onDone();
        router.refresh();
      })}
    >
      <BotGuard register={(name) => guard.register(name)} />
      <Controller
        control={form.control}
        name="rating"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Your rating</legend>
            <div className="flex gap-1" role="radiogroup" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => {
                const lit = n <= (hover || Number(field.value));
                return (
                  <motion.button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={Number(field.value) === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    whileTap={{ scale: 0.8 }}
                    animate={lit ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => field.onChange(n)}
                    className="grid size-tap place-items-center"
                  >
                    <Star className={cn("size-7 transition-colors", lit ? "fill-warning text-warning" : "text-subtle")} />
                  </motion.button>
                );
              })}
            </div>
            {errors.rating && <p className="mt-1 text-sm text-danger">{errors.rating.message}</p>}
          </fieldset>
        )}
      />
      <Field label="Title" maxLength={80} showCounter {...form.register("title")} error={errors.title?.message} valid={!!dirtyFields.title && !errors.title} shakeKey={submitCount} />
      <Field as="textarea" label="Review" maxLength={1500} showCounter {...form.register("body")} error={errors.body?.message} valid={!!dirtyFields.body && !errors.body} shakeKey={submitCount} hint="At least 20 characters. No HTML, links are shown as plain text." />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isSubmitting}>
          Post review
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </motion.form>
  );
}
