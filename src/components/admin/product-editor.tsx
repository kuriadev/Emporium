"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Grid3x3, ImagePlus, Images, Plus, Save, Trash2, Upload, WandSparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { formatMoney } from "@/lib/money";
import { CSRF_HEADER, readCsrfToken } from "@/lib/security/csrf";
import { cn } from "@/lib/utils";
import { productInputSchema, type ProductData, type ProductInput } from "@/lib/validations/admin";
import { deleteProductAction, saveProductAction } from "@/server/actions/admin";
import { MarkdownEditor } from "./markdown-editor";

export interface LibraryImage {
  src: string;
  label: string;
}

export interface ProductHistoryEntry {
  id: string;
  action: string;
  actor: string;
  at: number;
  changed: string[];
  reason: string | null;
}

type VariantRow = NonNullable<ProductInput["variants"]>[number];

export interface ProductPreset {
  label: string;
  values: ProductInput;
  matrix: { colors: string; sizes: string; materials: string; prefix: string };
}

const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_UPLOAD = 5 * 1024 * 1024;
const MAX_VARIANTS = 60;

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Short, stable SKU fragment: initials for multi-word values, consonant skeleton for long single words. */
export function skuCode(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").trim();
  if (!clean) return "";
  const words = clean.split(/\s+/);
  if (words.length > 1) return words.map((w) => w[0]).join("").slice(0, 4);
  const w = words[0]!;
  if (w.length <= 4) return w;
  return (w[0] + w.slice(1).replace(/[AEIOU]/g, "")).slice(0, 3);
}

function parseList(raw: string): { name: string; hex: string }[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^(.*?)\s*(#[0-9a-fA-F]{6})?$/.exec(part)!;
      return { name: (m[1] ?? "").trim().slice(0, 40), hex: m[2] ?? "" };
    })
    .filter((x) => x.name);
}

/** Rebuilds the generator inputs from an existing variant list so editing starts from what's live. */
function matrixFromVariants(rows: VariantRow[], brand: string): ProductPreset["matrix"] {
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const colors = uniq(rows.map((v) => (v.color ? `${v.color}${v.colorHex ? ` ${v.colorHex}` : ""}` : "")));
  const sizes = uniq(rows.map((v) => v.size ?? ""));
  const materials = uniq(rows.map((v) => v.material ?? ""));
  const codes = new Set([...rows.flatMap((v) => [v.color, v.size, v.material])].filter(Boolean).map((x) => skuCode(String(x))));
  const split = rows.map((v) => String(v.sku ?? "").split("-"));
  const common: string[] = [];
  for (let i = 0; split.length && i < split[0]!.length; i++) {
    const seg = split[0]![i]!;
    if (split.every((parts) => parts[i] === seg)) common.push(seg);
    else break;
  }
  while (common.length > 1 && codes.has(common.at(-1)!)) common.pop();
  return { colors: colors.join(", "), sizes: sizes.join(", "), materials: materials.join(", "), prefix: common.join("-") || skuCode(brand) || "EMP" };
}

const sameCombo = (v: VariantRow, color: string, size: string, material: string) =>
  (v.color ?? "").toLowerCase() === color.toLowerCase() && (v.size ?? "").toLowerCase() === size.toLowerCase() && (v.material ?? "").toLowerCase() === material.toLowerCase();

const inputCls =
  "min-h-[2.5rem] pointer-coarse:min-h-tap w-full min-w-0 rounded-sm border border-line bg-bg/60 px-2.5 text-sm text-fg outline-none transition placeholder:text-subtle focus:border-accent focus:shadow-[0_0_0_0.1875rem_oklch(0.78_0.11_315/0.25)] aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger/10";

function Section({ title, description, children, id, aside }: { title: string; description?: string; children: React.ReactNode; id: string; aside?: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-line bg-surface/50 p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="text-lg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-subtle">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ProductEditor({
  defaults,
  isNew,
  canDelete,
  library,
  presets = [],
  sales,
  history = [],
}: {
  defaults: ProductInput;
  isNew: boolean;
  canDelete: boolean;
  library: LibraryImage[];
  presets?: ProductPreset[];
  sales?: { units: number; revenue: number };
  history?: ProductHistoryEntry[];
}) {
  const router = useRouter();
  const form = useForm<ProductInput, unknown, ProductData>({ resolver: zodResolver(productInputSchema), defaultValues: defaults, mode: "onTouched" });
  const { control, register, formState, setValue, getValues } = form;
  const { errors, isSubmitting, isDirty, submitCount } = formState;
  const images = useFieldArray({ control, name: "images" });
  const variants = useFieldArray({ control, name: "variants", keyName: "key" });
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [matrix, setMatrix] = useState(() => presets[0]?.matrix ?? matrixFromVariants(defaults.variants ?? [], String(defaults.brand ?? "")));
  const [startStock, setStartStock] = useState("10");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uid = useId();

  const [name, basePrice, status, watchedVariants] = useWatch({ control, name: ["name", "basePrice", "status", "variants"] });
  const priceNumber = Number(basePrice);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const combos = useMemo(() => {
    const colors = parseList(matrix.colors);
    const sizes = parseList(matrix.sizes);
    const materials = parseList(matrix.materials);
    return (colors.length || 1) * (sizes.length || 1) * (materials.length || 1);
  }, [matrix]);

  const generate = () => {
    const colors = parseList(matrix.colors);
    const sizes = parseList(matrix.sizes);
    const materials = parseList(matrix.materials);
    if (!colors.length && !sizes.length && !materials.length) return toast.error("Add at least one colour, size or material.");
    if (combos > MAX_VARIANTS) return toast.error(`That makes ${combos} variants. The limit is ${MAX_VARIANTS}.`);
    const prefix = skuCode(matrix.prefix) ? matrix.prefix.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16) : "EMP";
    const current = getValues("variants") ?? [];
    const stock = Math.max(0, Math.min(100_000, Math.floor(Number(startStock) || 0)));
    const used = new Set<string>();
    const next: VariantRow[] = [];
    for (const c of colors.length ? colors : [{ name: "", hex: "" }])
      for (const s of sizes.length ? sizes : [{ name: "", hex: "" }])
        for (const m of materials.length ? materials : [{ name: "", hex: "" }]) {
          const keep = current.find((v) => sameCombo(v, c.name, s.name, m.name));
          let sku = keep?.sku ?? [prefix, skuCode(c.name), skuCode(s.name), skuCode(m.name)].filter(Boolean).join("-");
          for (let i = 2; used.has(sku); i++) sku = `${sku.replace(/-\d+$/, "")}-${i}`;
          used.add(sku);
          next.push(
            keep
              ? { ...keep, colorHex: c.hex || keep.colorHex }
              : { sku, color: c.name, colorHex: c.hex, size: s.name, material: m.name, priceOverride: "", stock, reorderThreshold: 5 },
          );
        }
    const kept = next.filter((n) => current.some((v) => v.sku === n.sku)).length;
    variants.replace(next);
    toast.success(`Generated ${next.length} variants`, { description: kept ? `${kept} existing variants kept their stock and SKU.` : undefined });
  };

  const upload = async (file: File) => {
    if (!UPLOAD_TYPES.includes(file.type)) return toast.error("Use a PNG, JPEG or WebP image.");
    if (file.size > MAX_UPLOAD) return toast.error("Images must be 5 MB or smaller.");
    if (images.fields.length >= 8) return toast.error("A product can have up to 8 images.");
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body, credentials: "same-origin", headers: { [CSRF_HEADER]: readCsrfToken() } });
      const json = (await res.json().catch(() => null)) as { ok: boolean; src?: string; error?: string } | null;
      if (!res.ok || !json?.ok || !json.src) return toast.error(json?.error ?? "Upload failed.");
      images.append({ src: json.src, alt: getValues("name") || "Product photo" });
      toast.success("Image uploaded", { description: "Checked for type, size and dimensions on the server." });
    } catch {
      toast.error("Network error. The image was not uploaded.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onSubmit = form.handleSubmit(async () => {
    // Send the raw form values: the server parses them with the same schema (pesos → centavos once).
    const res = await saveProductAction(getValues());
    if (!res.ok) {
      toast.error(res.error);
      for (const [key, message] of Object.entries(res.fieldErrors ?? {})) form.setError(key as FieldPath<ProductInput>, { message });
      return;
    }
    toast.success(res.message ?? "Saved");
    form.reset(getValues());
    if (isNew) router.replace(`/admin/products/${res.data.id}`);
    else router.refresh();
  });

  const remove = async () => {
    const id = getValues("id");
    if (!id) return;
    setDeleting(true);
    const res = await deleteProductAction(id);
    setDeleting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(res.message ?? "Done");
    form.reset(getValues());
    router.push("/admin/products");
  };

  const applyPreset = (p: ProductPreset) => {
    form.reset(p.values, { keepDefaultValues: true });
    setMatrix(p.matrix);
    setSlugTouched(false);
    toast.success(`Filled with “${p.label}”`);
  };

  const variantErr = (i: number, key: keyof VariantRow) => errors.variants?.[i]?.[key]?.message as string | undefined;
  const stockTotal = (watchedVariants ?? []).reduce((a, v) => a + (Number(v?.stock) || 0), 0);

  return (
    <form noValidate onSubmit={onSubmit} className="pb-28">
      {presets.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-subtle">Quick fill:</span>
          {presets.map((p) => (
            <button key={p.label} type="button" onClick={() => applyPreset(p)} className="min-h-[2.25rem] pointer-coarse:min-h-tap rounded-pill border border-dashed border-line-strong px-3 text-xs text-muted transition hover:border-fg hover:text-fg active:scale-95">
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <Section id="basics" title="Basics" description="What shoppers see first in listings and search.">
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Field
                label="Product name"
                required
                maxLength={120}
                showCounter
                {...register("name", {
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    if (!slugTouched) setValue("slug", slugify(e.target.value), { shouldDirty: true });
                  },
                })}
                error={errors.name?.message}
                shakeKey={submitCount}
              />
              <Field label="Brand" required maxLength={60} {...register("brand")} error={errors.brand?.message} shakeKey={submitCount} />
              <Field
                label="URL slug"
                required
                prefix={<span className="text-xs">/products/</span>}
                {...register("slug", { onChange: () => setSlugTouched(true) })}
                error={errors.slug?.message}
                hint="Lowercase words joined by dashes. Changing it breaks old links."
                shakeKey={submitCount}
              />
              <Field as="select" label="Category" {...register("category")} error={errors.category?.message}>
                <option value="gadgets">Gadgets</option>
                <option value="furniture">Home &amp; furniture</option>
                <option value="accessories">Accessories</option>
                <option value="clothes">Clothes</option>
              </Field>
            </div>
            <Field label="Tagline" maxLength={160} showCounter {...register("tagline")} error={errors.tagline?.message} hint="One line under the name on cards and the product page." shakeKey={submitCount} />
          </Section>

          <Section id="story" title="Description" description="Markdown, previewed exactly as it renders on the product page.">
            <Controller control={control} name="description" render={({ field, fieldState }) => <MarkdownEditor label="Product story" value={(field.value as string) ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
            <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
              <Field label="Materials" maxLength={200} {...register("materials")} error={errors.materials?.message} />
              <Field label="Dimensions & fit" maxLength={200} {...register("dimensions")} error={errors.dimensions?.message} />
            </div>
          </Section>

          <Section
            id="media"
            title="Media"
            description="First image is the cover. Uploads are checked for type, size and dimensions on the server."
            aside={
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setLibraryOpen(true)} disabled={images.fields.length >= 8}>
                  <Images className="size-4" aria-hidden /> Library
                </Button>
                <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => fileInput.current?.click()} disabled={images.fields.length >= 8}>
                  <Upload className="size-4" aria-hidden /> Upload
                </Button>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
              </div>
            }
          >
            {images.fields.length === 0 ? (
              <button type="button" onClick={() => setLibraryOpen(true)} className={cn("flex w-full flex-col items-center gap-2 rounded-md border border-dashed p-8 text-sm text-muted transition hover:border-fg hover:text-fg", errors.images ? "border-danger text-danger" : "border-line-strong")}>
                <ImagePlus className="size-6" aria-hidden />
                {errors.images?.message ?? "Add at least one image"}
              </button>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                <AnimatePresence initial={false}>
                  {images.fields.map((img, i) => (
                    <motion.li key={img.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-3 rounded-md border border-line bg-bg/40 p-2">
                      <span className="relative size-20 shrink-0 overflow-hidden rounded-sm bg-white">
                        <Image src={img.src} alt="" fill sizes="5rem" className="object-cover" />
                        {i === 0 && <span className="absolute left-1 top-1 rounded-xs bg-bg/80 px-1.5 text-2xs text-fg">Cover</span>}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <label className="text-2xs text-subtle" htmlFor={`${uid}-alt-${i}`}>
                          Alt text for screen readers
                        </label>
                        <input id={`${uid}-alt-${i}`} {...register(`images.${i}.alt`)} aria-invalid={!!errors.images?.[i]?.alt} maxLength={140} className={inputCls} />
                        {errors.images?.[i]?.alt && <span className="text-xs text-danger">{errors.images[i]!.alt!.message}</span>}
                        <div className="flex gap-1">
                          <button type="button" disabled={i === 0} onClick={() => images.move(i, i - 1)} aria-label="Move image earlier" className="grid size-9 place-items-center rounded-sm text-muted hover:bg-white/10 hover:text-fg disabled:opacity-30">
                            <ArrowUp className="size-4" />
                          </button>
                          <button type="button" disabled={i === images.fields.length - 1} onClick={() => images.move(i, i + 1)} aria-label="Move image later" className="grid size-9 place-items-center rounded-sm text-muted hover:bg-white/10 hover:text-fg disabled:opacity-30">
                            <ArrowDown className="size-4" />
                          </button>
                          <button type="button" onClick={() => images.remove(i)} aria-label="Remove image" className="ml-auto grid size-9 place-items-center rounded-sm text-muted hover:bg-danger/15 hover:text-danger">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Section>

          <Section id="variants" title="Variants & inventory" description={`${variants.fields.length} variants · ${stockTotal.toLocaleString("en-PH")} units on hand`}>
            <div className="rounded-md border border-accent/30 bg-accent/[0.05] p-4">
              <p className="mb-3 flex items-center gap-2 text-sm">
                <Grid3x3 className="size-4 text-accent" aria-hidden /> Variant matrix generator
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Colours <span className="text-subtle">Comma separated, optional #hex</span>
                  <input value={matrix.colors} onChange={(e) => setMatrix({ ...matrix, colors: e.target.value })} placeholder="Navy #1f2a5c, Black #111111" className={inputCls} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Sizes <span className="text-subtle">e.g. S, M, L or 128GB, 256GB</span>
                  <input value={matrix.sizes} onChange={(e) => setMatrix({ ...matrix, sizes: e.target.value })} placeholder="S, M, L, XL" className={inputCls} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Materials <span className="text-subtle">Optional</span>
                  <input value={matrix.materials} onChange={(e) => setMatrix({ ...matrix, materials: e.target.value })} placeholder="Silicone, Leather" className={inputCls} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  SKU prefix
                  <input value={matrix.prefix} onChange={(e) => setMatrix({ ...matrix, prefix: e.target.value.toUpperCase().slice(0, 16) })} placeholder="EMS-OVR" className={cn(inputCls, "font-mono uppercase")} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Starting stock for new variants
                  <input inputMode="numeric" value={startStock} onChange={(e) => setStartStock(e.target.value.replace(/\D/g, "").slice(0, 6))} className={cn(inputCls, "tabular-nums")} />
                </label>
                <div className="flex items-end">
                  <Button type="button" variant="accent" size="sm" className="min-h-[2.5rem] pointer-coarse:min-h-tap w-full" onClick={generate} disabled={combos > MAX_VARIANTS}>
                    <WandSparkles className="size-4" aria-hidden /> Generate {combos} {combos === 1 ? "variant" : "variants"}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-subtle">Existing combinations keep their SKU, stock and price. Combinations you remove are dropped (sold variants are kept at zero stock for order history).</p>
            </div>

            {typeof errors.variants?.message === "string" && <p className="mt-3 text-sm text-danger">{errors.variants.message}</p>}
            {typeof errors.variants?.root?.message === "string" && <p className="mt-3 text-sm text-danger">{errors.variants.root.message}</p>}

            <div className="relative mt-4 overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="bg-surface text-xs text-subtle">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2 font-normal">
                      SKU
                    </th>
                    <th scope="col" className="px-2 py-2 font-normal">
                      Colour
                    </th>
                    <th scope="col" className="px-2 py-2 font-normal">
                      Size
                    </th>
                    <th scope="col" className="px-2 py-2 font-normal">
                      Material
                    </th>
                    <th scope="col" className="px-2 py-2 font-normal">
                      Price override (₱)
                    </th>
                    <th scope="col" className="px-2 py-2 font-normal">
                      Stock
                    </th>
                    <th scope="col" className="px-2 py-2 font-normal">
                      Reorder at
                    </th>
                    <th scope="col" className="px-2 py-2">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {variants.fields.map((v, i) => {
                    const stock = Number(watchedVariants?.[i]?.stock ?? 0);
                    const threshold = Number(watchedVariants?.[i]?.reorderThreshold ?? 5);
                    const hex = (watchedVariants?.[i]?.colorHex as string) || "";
                    return (
                      <tr key={v.key} className="align-top">
                        <td className="sticky left-0 z-10 bg-bg px-3 py-2">
                          <input {...register(`variants.${i}.sku`)} aria-label={`SKU, row ${i + 1}`} aria-invalid={!!variantErr(i, "sku")} className={cn(inputCls, "w-[11rem] font-mono uppercase")} />
                          {variantErr(i, "sku") && <p className="mt-1 max-w-[11rem] text-xs text-danger">{variantErr(i, "sku")}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <span aria-hidden className="size-5 shrink-0 rounded-full border border-line-strong" style={{ background: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "transparent" }} />
                            <input {...register(`variants.${i}.color`)} aria-label={`Colour, row ${i + 1}`} className={cn(inputCls, "w-[8rem]")} />
                            <input {...register(`variants.${i}.colorHex`)} aria-label={`Colour hex, row ${i + 1}`} aria-invalid={!!variantErr(i, "colorHex")} placeholder="#1f2a5c" className={cn(inputCls, "w-[6rem] font-mono")} />
                          </div>
                          {variantErr(i, "colorHex") && <p className="mt-1 text-xs text-danger">{variantErr(i, "colorHex")}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <input {...register(`variants.${i}.size`)} aria-label={`Size, row ${i + 1}`} className={cn(inputCls, "w-[6rem]")} />
                        </td>
                        <td className="px-2 py-2">
                          <input {...register(`variants.${i}.material`)} aria-label={`Material, row ${i + 1}`} className={cn(inputCls, "w-[7rem]")} />
                        </td>
                        <td className="px-2 py-2">
                          <input {...register(`variants.${i}.priceOverride`)} inputMode="decimal" aria-label={`Price override, row ${i + 1}`} aria-invalid={!!variantErr(i, "priceOverride")} placeholder={Number.isFinite(priceNumber) && priceNumber > 0 ? priceNumber.toLocaleString("en-PH") : "Base"} className={cn(inputCls, "w-[7rem] tabular-nums")} />
                          {variantErr(i, "priceOverride") && <p className="mt-1 text-xs text-danger">{variantErr(i, "priceOverride")}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <input {...register(`variants.${i}.stock`)} inputMode="numeric" aria-label={`Stock, row ${i + 1}`} aria-invalid={!!variantErr(i, "stock")} className={cn(inputCls, "w-[5.5rem] tabular-nums", stock <= threshold && "border-warning/70 text-warning")} />
                          {variantErr(i, "stock") && <p className="mt-1 text-xs text-danger">{variantErr(i, "stock")}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <input {...register(`variants.${i}.reorderThreshold`)} inputMode="numeric" aria-label={`Reorder threshold, row ${i + 1}`} className={cn(inputCls, "w-[5rem] tabular-nums")} />
                        </td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => variants.remove(i)} disabled={variants.fields.length === 1} aria-label={`Remove variant ${i + 1}`} className="grid size-10 place-items-center rounded-sm text-muted hover:bg-danger/15 hover:text-danger disabled:opacity-30">
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              disabled={variants.fields.length >= MAX_VARIANTS}
              onClick={() => variants.append({ sku: `${matrix.prefix || "EMP"}-${variants.fields.length + 1}`.toUpperCase(), color: "", colorHex: "", size: "", material: "", priceOverride: "", stock: 0, reorderThreshold: 5 })}
            >
              <Plus className="size-4" aria-hidden /> Add a variant
            </Button>
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
          <Section id="visibility" title="Visibility">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Product status" className="isolate grid grid-cols-3 gap-1 rounded-md border border-line p-1">
                  {(["active", "draft", "archived"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={field.value === s}
                      onClick={() => field.onChange(s)}
                      className={cn("relative min-h-tap rounded-sm text-sm capitalize transition-colors", field.value === s ? "text-bg" : "text-muted hover:text-fg")}
                    >
                      {field.value === s && <motion.span layoutId="status-pill" className="absolute inset-0 -z-10 rounded-sm bg-fg" transition={{ type: "spring", stiffness: 520, damping: 36 }} />}
                      {s}
                    </button>
                  ))}
                </div>
              )}
            />
            <p className="mt-2 text-xs text-subtle">
              {status === "active" ? "Live on the storefront and in search." : status === "draft" ? "Hidden from shoppers until you activate it." : "Hidden everywhere; kept for order history."}
            </p>
            <label className="mt-4 flex min-h-tap cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                Feature on the home page
                <span className="block text-xs text-subtle">Shows in Trending and Best sellers.</span>
              </span>
              <input type="checkbox" {...register("featured")} className="size-5 accent-[var(--color-accent)]" />
            </label>
            <label className="mt-2 flex min-h-tap cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                Volume pricing
                <span className="block text-xs text-subtle">Buy 2 save 10%, buy 3 or more save 20%.</span>
              </span>
              <input type="checkbox" {...register("tierPricing")} className="size-5 accent-[var(--color-accent)]" />
            </label>
          </Section>

          <Section id="pricing" title="Pricing" description="Pesos, VAT inclusive.">
            <Field label="Price" required inputMode="decimal" prefix="₱" {...register("basePrice")} error={errors.basePrice?.message} shakeKey={submitCount} />
            <Field label="Compare-at price" inputMode="decimal" prefix="₱" {...register("compareAtPrice")} error={errors.compareAtPrice?.message} hint="Shows a strike-through “was” price. Leave blank for none." shakeKey={submitCount} />
          </Section>

          {sales && (
            <Section id="performance" title="Performance">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-subtle">Units sold</dt>
                  <dd className="mt-1 text-xl">{sales.units.toLocaleString("en-PH")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Revenue</dt>
                  <dd className="mt-1 text-xl">{formatMoney(sales.revenue)}</dd>
                </div>
              </dl>
            </Section>
          )}

          {!isNew && (
            <Section id="history" title="Change history" description="From the audit log.">
              {history.length === 0 ? (
                <p className="text-sm text-subtle">No changes recorded yet.</p>
              ) : (
                <ol className="space-y-3 border-l border-line pl-4 text-sm">
                  {history.map((h) => (
                    <li key={h.id}>
                      <p>
                        <Badge>{h.action.replace(/^product\./, "").replace(/_/g, " ")}</Badge>{" "}
                        <span className="text-xs text-subtle">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(h.at)}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {h.actor}
                        {h.changed.length ? ` changed ${h.changed.join(", ")}` : ""}
                        {h.reason ? ` · ${h.reason}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          )}

          {!isNew && canDelete && (
            <Section id="danger" title="Delete product">
              <p className="mb-3 text-sm text-muted">Products that were ever ordered are archived instead, so receipts and order history stay intact.</p>
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden /> Delete {name || "product"}
              </Button>
            </Section>
          )}
        </div>
      </div>

      <div className="glass fixed inset-x-3 bottom-[5rem] z-40 mx-auto flex max-w-[56rem] items-center gap-3 rounded-lg p-3 lg:bottom-6 lg:left-[17.5rem]">
        <p className="mr-auto min-w-0 truncate text-sm text-muted" aria-live="polite">
          {Object.keys(errors).length > 0 ? <span className="text-danger">Fix the highlighted fields to save.</span> : isDirty ? "Unsaved changes" : isNew ? "New product" : "All changes saved"}
        </p>
        {isDirty && !isNew && (
          <Button type="button" variant="ghost" size="sm" className="min-h-tap" onClick={() => form.reset()}>
            Discard
          </Button>
        )}
        <Button type="submit" size="sm" className="min-h-tap px-5" loading={isSubmitting}>
          <Save className="size-4" aria-hidden /> {isNew ? "Create product" : "Save changes"}
        </Button>
      </div>

      <Modal open={libraryOpen} onOpenChange={setLibraryOpen} title="Media library" description="Bundled product photography and images uploaded by your team." className="max-w-[48rem]">
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {library.map((img) => {
            const used = images.fields.some((f) => f.src === img.src);
            return (
              <li key={img.src}>
                <button
                  type="button"
                  disabled={used || images.fields.length >= 8}
                  onClick={() => {
                    images.append({ src: img.src, alt: `${getValues("name") || img.label}` });
                    toast.success("Image added");
                  }}
                  className="group block w-full text-left disabled:opacity-40"
                >
                  <span className="relative block aspect-square overflow-hidden rounded-sm bg-white ring-accent transition group-hover:ring-2 group-focus-visible:ring-2">
                    <Image src={img.src} alt="" fill sizes="(min-width: 40rem) 11rem, 45vw" className="object-cover" />
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted">{used ? "Already added" : img.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>

      <Modal open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete ${name || "this product"}?`} description="If it has ever been ordered it will be archived instead." className="max-w-[32rem]">
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button variant="danger" loading={deleting} onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      </Modal>
    </form>
  );
}
