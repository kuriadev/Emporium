"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, PackageSearch, Pencil, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { bulkProductAction, deleteProductAction, setProductStatusAction } from "@/server/actions/admin";
import { EmptyState } from "./ui";

type Status = "active" | "draft" | "archived";

export interface AdminProductRow {
  id: string;
  name: string;
  brand: string;
  slug: string;
  category: string;
  status: Status;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  totalStock: number;
  lowCount: number;
  variantCount: number;
  updatedAt: number;
}

const STATUS_TONE: Record<Status, "success" | "warning" | "neutral"> = { active: "success", draft: "warning", archived: "neutral" };
const STATUS_ACTION: Record<Status, "activate" | "draft" | "archive"> = { active: "activate", draft: "draft", archived: "archive" };
const updated = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

type BulkKind = "activate" | "draft" | "archive" | "adjust_price" | "set_stock";

export function ProductsTable({ rows: initial, canDelete, query }: { rows: AdminProductRow[]; canDelete: boolean; query: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BulkKind>("activate");
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminProductRow | null>(null);
  const [, startTransition] = useTransition();

  // Server refreshes hand us new rows: adopt them during render (no effect round-trip) and drop stale selections.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setRows(initial);
    setSelected((s) => new Set([...s].filter((id) => initial.some((r) => r.id === id))));
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const refresh = () => startTransition(() => router.refresh());

  /** Restores the statuses captured before a change, grouped so it is one request per status. */
  const restore = async (before: Map<string, Status>) => {
    const groups = new Map<Status, string[]>();
    for (const [id, st] of before) groups.set(st, [...(groups.get(st) ?? []), id]);
    for (const [st, ids] of groups) {
      const res = await bulkProductAction({ productIds: ids, action: STATUS_ACTION[st] });
      if (!res.ok) return toast.error(res.error);
    }
    toast.success("Change undone");
    refresh();
  };

  const setStatus = async (row: AdminProductRow, status: Status) => {
    const before = row.status;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status } : r)));
    const res = await setProductStatusAction(row.id, status);
    if (!res.ok) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: before } : r)));
      toast.error(res.error);
      return;
    }
    toast.success(`${row.name} is now ${status}`, { action: { label: "Undo", onClick: () => void restore(new Map([[row.id, before]])) } });
    refresh();
  };

  const runBulk = async () => {
    const ids = [...selected];
    const isStatus = bulk === "activate" || bulk === "draft" || bulk === "archive";
    const value = Number(amount);
    if (bulk === "adjust_price" && (!Number.isFinite(value) || value < -90 || value > 100 || value === 0)) return toast.error("Enter a change between -90% and +100%.");
    if (bulk === "set_stock" && (!Number.isInteger(value) || value < 0 || value > 100_000)) return toast.error("Stock must be a whole number from 0 to 100,000.");
    const before = new Map(rows.filter((r) => selected.has(r.id)).map((r) => [r.id, r.status]));
    setBusy(true);
    if (isStatus) {
      const next: Status = bulk === "activate" ? "active" : bulk === "draft" ? "draft" : "archived";
      setRows((rs) => rs.map((r) => (selected.has(r.id) ? { ...r, status: next } : r)));
    }
    const res = await bulkProductAction({ productIds: ids, action: bulk, value: isStatus ? undefined : value });
    setBusy(false);
    if (!res.ok) {
      setRows(initial);
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Updated", isStatus ? { action: { label: "Undo", onClick: () => void restore(before) } } : { description: "Recorded in the audit log." });
    setSelected(new Set());
    refresh();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const res = await deleteProductAction(confirmDelete.id);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(res.message ?? "Done");
    setConfirmDelete(null);
    refresh();
  };

  const totals = useMemo(() => ({ units: rows.reduce((a, r) => a + r.totalStock, 0), low: rows.filter((r) => r.lowCount > 0).length }), [rows]);

  if (rows.length === 0) {
    return (
      <EmptyState icon={<PackageSearch className="size-7" />} title={query ? `No products match “${query}”` : "No products in this view"}>
        Try another filter, or{" "}
        <Link href="/admin/products/new" className="text-accent hover:underline">
          create a product
        </Link>
        .
      </EmptyState>
    );
  }

  const statusSelect = (r: AdminProductRow) => (
    <select
      aria-label={`Status for ${r.name}`}
      value={r.status}
      onChange={(e) => void setStatus(r, e.target.value as Status)}
      className="min-h-[2.25rem] pointer-coarse:min-h-tap cursor-pointer rounded-pill border border-line bg-surface px-3 text-xs text-fg outline-none transition hover:border-line-strong focus:border-accent"
    >
      <option value="active">Active</option>
      <option value="draft">Draft</option>
      <option value="archived">Archived</option>
    </select>
  );

  const actions = (r: AdminProductRow) => (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/admin/products/${r.id}`} className="grid size-tap place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-fg" aria-label={`Edit ${r.name}`}>
        <Pencil className="size-4" />
      </Link>
      {r.status === "active" && (
        <Link href={`/products/${r.slug}`} target="_blank" className="grid size-tap place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-fg" aria-label={`View ${r.name} on the storefront (opens in a new tab)`}>
          <Eye className="size-4" />
        </Link>
      )}
      {canDelete && (
        <button type="button" onClick={() => setConfirmDelete(r)} className="grid size-tap place-items-center rounded-full text-muted transition hover:bg-danger/15 hover:text-danger" aria-label={`Delete ${r.name}`}>
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );

  const stockCell = (r: AdminProductRow) => (
    <span className="flex flex-col">
      <span className="tabular-nums">{r.totalStock.toLocaleString("en-PH")} units</span>
      {r.lowCount > 0 ? (
        <span className="text-xs text-warning">
          {r.lowCount} of {r.variantCount} variants low
        </span>
      ) : (
        <span className="text-xs text-subtle">{r.variantCount === 1 ? "1 variant" : `${r.variantCount} variants`}</span>
      )}
    </span>
  );

  const thumb = (r: AdminProductRow) => (
    <span className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-white">
      {r.image ? <Image src={r.image} alt="" fill sizes="3rem" className="object-cover" /> : null}
    </span>
  );

  return (
    <div>
      <p className="mb-3 text-xs text-subtle">
        {rows.length} products · {totals.units.toLocaleString("en-PH")} units on hand · {totals.low} need restocking
      </p>

      {/* Desktop and tablet: table with a sticky product column for horizontal scrolling. */}
      <div className="relative hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-surface text-xs text-subtle">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface py-3 pl-4 pr-2 font-normal">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label="Select all products"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = selected.size > 0 && !allSelected;
                    }}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="size-4 accent-[var(--color-accent)]"
                  />
                  Product
                </span>
              </th>
              <th scope="col" className="px-3 py-3 font-normal">
                Status
              </th>
              <th scope="col" className="px-3 py-3 text-right font-normal">
                Price
              </th>
              <th scope="col" className="px-3 py-3 font-normal">
                Inventory
              </th>
              <th scope="col" className="px-3 py-3 font-normal">
                Category
              </th>
              <th scope="col" className="px-3 py-3 font-normal">
                Updated
              </th>
              <th scope="col" className="px-3 py-3 text-right font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={cn("group transition-colors", selected.has(r.id) ? "bg-accent/[0.06]" : "hover:bg-white/[0.03]")}>
                <td className="sticky left-0 z-10 bg-bg py-3 pl-4 pr-2 group-hover:bg-[oklch(0.1_0_0)]">
                  <span className="flex items-center gap-3">
                    <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[var(--color-accent)]" />
                    {thumb(r)}
                    <span className="min-w-0">
                      <Link href={`/admin/products/${r.id}`} className="block truncate hover:underline">
                        {r.name}
                      </Link>
                      <span className="block truncate text-xs text-subtle">
                        {r.brand} · /{r.slug}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3">{statusSelect(r)}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatMoney(r.price)}
                  {r.compareAtPrice && <span className="block text-xs text-subtle line-through">{formatMoney(r.compareAtPrice)}</span>}
                </td>
                <td className="px-3 py-3">{stockCell(r)}</td>
                <td className="px-3 py-3 capitalize text-muted">{r.category}</td>
                <td className="px-3 py-3 text-muted">{updated.format(r.updatedAt)}</td>
                <td className="px-3 py-3">{actions(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per product. */}
      <ul className="space-y-3 md:hidden">
        <li className="flex items-center gap-3 px-1 text-sm text-muted">
          <input
            id="select-all-m"
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
            className="size-4 accent-[var(--color-accent)]"
          />
          <label htmlFor="select-all-m">Select all</label>
        </li>
        {rows.map((r) => (
          <li key={r.id} className={cn("rounded-lg border p-3", selected.has(r.id) ? "border-accent/60 bg-accent/[0.06]" : "border-line bg-surface/50")}>
            <div className="flex items-start gap-3">
              <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="mt-4 size-4 shrink-0 accent-[var(--color-accent)]" />
              {thumb(r)}
              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${r.id}`} className="block truncate">
                  {r.name}
                </Link>
                <p className="truncate text-xs text-subtle">
                  {r.brand} · <span className="capitalize">{r.category}</span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  <span className="text-sm tabular-nums">{formatMoney(r.price)}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
              {stockCell(r)}
              <div className="flex items-center gap-1">
                {statusSelect(r)}
                {actions(r)}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: "120%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "120%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
            role="region"
            aria-label="Bulk actions"
            className="glass fixed inset-x-3 bottom-[5rem] z-40 mx-auto flex max-w-[56rem] flex-wrap items-center gap-2 rounded-lg p-3 lg:bottom-6 lg:left-[17.5rem]"
          >
            <span className="mr-auto flex items-center gap-2 text-sm">
              <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-fg">
                <X className="size-4" />
              </button>
              {selected.size} selected
            </span>
            <label className="sr-only" htmlFor="bulk-action">
              Bulk action
            </label>
            <select id="bulk-action" value={bulk} onChange={(e) => setBulk(e.target.value as BulkKind)} className="min-h-tap rounded-pill border border-line-strong bg-surface px-4 text-sm outline-none focus:border-accent">
              <option value="activate">Set active</option>
              <option value="draft">Move to draft</option>
              <option value="archive">Archive</option>
              <option value="adjust_price">Adjust price by %</option>
              <option value="set_stock">Set stock for every variant</option>
            </select>
            {(bulk === "adjust_price" || bulk === "set_stock") && (
              <span className="flex items-center gap-2">
                <label htmlFor="bulk-amount" className="sr-only">
                  {bulk === "adjust_price" ? "Percent change" : "Units in stock"}
                </label>
                <input
                  id="bulk-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.-]/g, "").slice(0, 7))}
                  className="min-h-tap w-[6rem] rounded-pill border border-line-strong bg-surface px-4 text-sm tabular-nums outline-none focus:border-accent"
                />
                <span className="text-sm text-muted">{bulk === "adjust_price" ? "%" : "units"}</span>
              </span>
            )}
            <Button size="sm" className="min-h-tap" loading={busy} onClick={() => void runBulk()}>
              Apply
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)} title={`Delete ${confirmDelete?.name ?? "product"}?`} description="Products with order history are archived instead, so past orders and invoices stay intact." className="max-w-[32rem]">
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
            Keep it
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void remove()}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
