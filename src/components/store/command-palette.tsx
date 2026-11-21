"use client";

import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SearchSuggestion } from "@/lib/types";
import { searchAction } from "@/server/actions/shop";
import { useCart } from "@/stores/cart";

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  group: string;
}

export const itemClass =
  "flex min-h-tap cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-sm text-muted data-[selected=true]:bg-white/10 data-[selected=true]:text-fg";

/** Ctrl/⌘+K launcher. Static destinations + live product matches from the server. */
export function CommandPalette({ items, extraSearch }: { items: PaletteItem[]; extraSearch?: (q: string) => Promise<PaletteItem[]> }) {
  const open = useCart((s) => s.panel === "command");
  const setPanel = useCart((s) => s.setPanel);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [live, setLive] = useState<PaletteItem[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPanel(useCart.getState().panel === "command" ? null : "command");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanel]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setLive([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const results = extraSearch
        ? await extraSearch(q)
        : ((await searchAction(q)) as SearchSuggestion).products.map((p) => ({ id: p.id, label: p.name, hint: p.brand, href: `/products/${p.slug}`, group: "Products" }));
      if (alive) setLive(results);
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, extraSearch]);

  const run = (href: string) => {
    setPanel(null);
    setQ("");
    router.push(href);
  };

  const groups = new Map<string, PaletteItem[]>();
  for (const it of [...live, ...items]) groups.set(it.group, [...(groups.get(it.group) ?? []), it]);

  return (
    <D.Root open={open} onOpenChange={(o) => setPanel(o ? "command" : null)}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <D.Content className="glass fixed left-1/2 top-[12%] z-[71] w-[min(calc(100vw-2rem),40rem)] -translate-x-1/2 overflow-hidden rounded-lg">
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Type to jump to pages, products, orders or admin views</D.Description>
          <Command label="Command palette" shouldFilter={!extraSearch || q.length < 2} loop>
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder="Jump to a product, category, order…"
              className="min-h-[3.5rem] w-full border-b border-line bg-transparent px-5 text-base outline-none placeholder:text-subtle"
            />
            <Command.List className="max-h-[min(60dvh,26rem)] overflow-y-auto p-2">
              <Command.Empty className="p-6 text-center text-sm text-muted">No results. Try a SKU, order number or product name.</Command.Empty>
              {[...groups].map(([group, list]) => (
                <Command.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.25em] [&_[cmdk-group-heading]]:text-subtle">
                  {list.map((it) => (
                    <Command.Item key={`${group}-${it.id}`} value={`${it.label} ${it.hint ?? ""} ${it.id}`} onSelect={() => run(it.href)} className={itemClass}>
                      <span>{it.label}</span>
                      {it.hint && <span className="text-xs text-subtle">{it.hint}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
            <div className="flex justify-between border-t border-line px-4 py-2 text-2xs text-subtle">
              <span>↑↓ navigate · ↵ open · esc close</span>
              <span>Ctrl/⌘ K</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
