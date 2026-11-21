"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { BellRing, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Price, StockStatus } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { VariantView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { emailSchema } from "@/lib/validations/common";
import { restockAlertAction } from "@/server/actions/shop";
import { useCart } from "@/stores/cart";
import { QuantityStepper } from "./cart-pieces";

type Dim = "color" | "size" | "material";
const DIMS: { key: Dim; label: string }[] = [
  { key: "color", label: "Colour" },
  { key: "size", label: "Size" },
  { key: "material", label: "Material" },
];

export function useVariantSelection(variants: VariantView[]) {
  const initial = variants.find((v) => v.stock > 0) ?? variants[0]!;
  const [sel, setSel] = useState<Record<Dim, string | null>>({ color: initial.color, size: initial.size, material: initial.material });
  const dims = DIMS.filter((d) => new Set(variants.map((v) => v[d.key]).filter(Boolean)).size > 0);
  const selected = variants.find((v) => dims.every((d) => v[d.key] === sel[d.key])) ?? null;

  const options = useMemo(
    () =>
      dims.map((d) => ({
        ...d,
        values: [...new Set(variants.map((v) => v[d.key]).filter((x): x is string => !!x))].map((value) => {
          const match = variants.find((v) => v[d.key] === value && dims.every((o) => o.key === d.key || v[o.key] === sel[o.key]));
          const any = variants.filter((v) => v[d.key] === value);
          return { value, hex: any[0]?.colorHex ?? null, available: (match ?? any[0])?.stock ? (match ?? any[0])!.stock > 0 : false, exists: !!match };
        }),
      })),
    [variants, sel, dims],
  );

  const choose = (key: Dim, value: string) => {
    const next = { ...sel, [key]: value };
    if (!variants.some((v) => dims.every((d) => v[d.key] === next[d.key]))) {
      const fallback = variants.find((v) => v[key] === value && v.stock > 0) ?? variants.find((v) => v[key] === value);
      if (fallback) {
        setSel({ color: fallback.color, size: fallback.size, material: fallback.material });
        return;
      }
    }
    setSel(next);
  };

  return { selected, options, choose, sel };
}

export function VariantOptions({ options, sel, choose }: ReturnType<typeof useVariantSelection>) {
  if (!options.length) return null;
  return (
    <div className="space-y-5">
      {options.map((o) => (
        <fieldset key={o.key}>
          <legend className="mb-2 text-sm text-muted">
            {o.label}: <span className="text-fg">{sel[o.key]}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {o.values.map((v) => {
              const active = sel[o.key] === v.value;
              return o.key === "color" && v.hex ? (
                <motion.button
                  key={v.value}
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  onClick={() => choose(o.key, v.value)}
                  aria-pressed={active}
                  aria-label={`${v.value}${v.available ? "" : " (sold out)"}`}
                  title={v.value}
                  className="grid size-tap place-items-center rounded-full"
                >
                  <span className={cn("relative size-8 rounded-full ring-1 ring-white/30 ring-offset-2 ring-offset-bg transition", active && "ring-2 ring-fg", !v.available && "opacity-40")} style={{ background: v.hex }}>
                    {!v.available && <span className="absolute left-1/2 top-1/2 h-px w-10 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-fg" />}
                  </span>
                </motion.button>
              ) : (
                <motion.button
                  key={v.value}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => choose(o.key, v.value)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-tap min-w-[3.5rem] rounded-pill border px-4 text-sm transition",
                    active ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-line-strong hover:text-fg",
                    !v.available && !active && "line-through opacity-50",
                  )}
                >
                  {v.value}
                </motion.button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function AddToBag({ variant, productName, onAdded, sticky }: { variant: VariantView | null; productName: string; onAdded?: () => void; sticky?: boolean }) {
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const busy = useCart((s) => !!variant && s.busyVariant === variant.id);
  const [surge, setSurge] = useState(false);

  if (!variant) return <p className="text-sm text-warning">This combination isn&apos;t available. Pick another option.</p>;
  if (variant.stock <= 0) return <RestockForm variantId={variant.id} />;

  return (
    <div className={cn("flex items-center gap-3", sticky && "w-full")}>
      {!sticky && <QuantityStepper value={qty} max={variant.stock} label={productName} onChange={(n) => setQty(Math.max(1, n))} />}
      <Button
        size="lg"
        className="flex-1"
        loading={busy}
        success={surge}
        onClick={async () => {
          const ok = await add(variant.id, sticky ? 1 : qty);
          if (ok) {
            setSurge(true);
            setTimeout(() => setSurge(false), 900);
            onAdded?.();
          }
        }}
      >
        <ShoppingBag className="size-5" aria-hidden /> Add to bag
      </Button>
    </div>
  );
}

const restockSchema = z.object({ email: emailSchema });

export function RestockForm({ variantId }: { variantId: string }) {
  const [done, setDone] = useState(false);
  const form = useForm<z.input<typeof restockSchema>, unknown, z.output<typeof restockSchema>>({
    resolver: zodResolver(restockSchema),
    defaultValues: { email: "alex.rivera@example.com" },
    mode: "onTouched",
  });
  const { errors, isSubmitting, submitCount, dirtyFields } = form.formState;

  if (done)
    return (
      <p className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-4 text-sm text-success" role="status">
        <BellRing className="size-4" /> You&apos;re on the list. We&apos;ll email you when it&apos;s back.
      </p>
    );

  return (
    <form
      noValidate
      className="space-y-3 rounded-md border border-line bg-surface/60 p-4"
      onSubmit={form.handleSubmit(async (data) => {
        const res = await restockAlertAction({ variantId, email: data.email });
        if (res.ok) {
          setDone(true);
          toast.success(res.message);
        } else toast.error(res.error);
      })}
    >
      <p className="text-sm">Sold out right now. Get a one-time email when it&apos;s restocked.</p>
      <Field label="Email" type="email" autoComplete="email" {...form.register("email")} error={errors.email?.message} valid={!!dirtyFields.email && !errors.email} shakeKey={submitCount} />
      <Button type="submit" variant="outline" loading={isSubmitting} className="w-full">
        <BellRing className="size-4" /> Notify me
      </Button>
    </form>
  );
}

export function SelectedPrice({ variant, compareAt }: { variant: VariantView | null; compareAt: number | null }) {
  if (!variant) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Price value={variant.price} compareAt={compareAt} size="lg" />
      <StockStatus stock={variant.stock} />
    </div>
  );
}
