"use client";

import { Bold, Heading3, Italic, Link2, List } from "lucide-react";
import { useId, useMemo, useRef, useState, type TextareaHTMLAttributes } from "react";
import { renderSafeMarkdown } from "@/lib/security/sanitize";
import { cn } from "@/lib/utils";

const TOOLS: { icon: typeof Bold; label: string; args: [string, string?, string?, boolean?] }[] = [
  { icon: Bold, label: "Bold", args: ["**"] },
  { icon: Italic, label: "Italic", args: ["*"] },
  { icon: Heading3, label: "Heading", args: ["### ", "", "", true] },
  { icon: List, label: "Bulleted list", args: ["- ", "", "", true] },
  { icon: Link2, label: "Link", args: ["[", "](https://)", "link text"] },
];

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  maxLength?: number;
};

/**
 * Markdown editor with a live preview rendered by the same escape-first, allow-list renderer the
 * storefront uses, so what staff see here is exactly what shoppers get (no raw HTML, safe links only).
 */
export function MarkdownEditor({ label, value, onChange, error, maxLength = 8000, ...rest }: Props) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const html = useMemo(() => renderSafeMarkdown(value), [value]);

  /** Wraps the selection (or inserts a placeholder) and keeps focus/selection for fast typing. */
  const wrap = (before: string, after = before, placeholder = "text", linePrefix = false) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || placeholder;
    let next: string;
    let cursor: [number, number];
    if (linePrefix) {
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      next = value.slice(0, lineStart) + before + value.slice(lineStart);
      cursor = [s + before.length, e + before.length];
    } else {
      next = value.slice(0, s) + before + selected + after + value.slice(e);
      cursor = [s + before.length, s + before.length + selected.length];
    }
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(...cursor);
    });
  };


  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className={cn("text-sm tracking-wide", error ? "text-danger" : "text-muted")}>
          {label}
        </label>
        <div role="tablist" aria-label={`${label} mode`} className="flex rounded-pill border border-line p-0.5 text-xs lg:hidden">
          {(["write", "preview"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("min-h-[2rem] pointer-coarse:min-h-tap rounded-pill px-3 capitalize", tab === t ? "bg-fg text-bg" : "text-muted")}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className={cn("grid overflow-hidden rounded-md border lg:grid-cols-2", error ? "border-danger" : "border-line focus-within:border-accent")}>
        <div className={cn("flex min-w-0 flex-col", tab === "preview" && "hidden lg:flex")}>
          <div className="flex gap-1 border-b border-line bg-surface/80 p-1" role="toolbar" aria-label="Formatting">
            {TOOLS.map(({ icon: Icon, label: l, args }) => (
              <button key={l} type="button" onClick={() => wrap(...args)} aria-label={l} title={l} className="grid size-9 place-items-center rounded-sm text-muted transition hover:bg-white/10 hover:text-fg active:scale-90">
                <Icon className="size-4" />
              </button>
            ))}
            <span className="ml-auto self-center pr-2 text-2xs tabular-nums text-subtle">
              {value.length}/{maxLength}
            </span>
          </div>
          <textarea
            id={id}
            ref={ref}
            value={value}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            spellCheck
            className="min-h-[16rem] w-full flex-1 resize-y bg-bg/60 p-4 font-mono text-sm leading-relaxed text-fg outline-none"
            {...rest}
          />
        </div>
        <div className={cn("min-w-0 border-line bg-surface/40 lg:border-l", tab === "write" && "hidden lg:block")}>
          <p className="border-b border-line px-4 py-2.5 text-2xs uppercase tracking-[0.25em] text-subtle">Preview · as shoppers see it</p>
          {html ? (
            // Safe: renderSafeMarkdown escapes all input first and only emits an allow-list of tags.
            <div className="prose-safe max-h-[24rem] overflow-y-auto p-4 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="p-4 text-sm text-subtle">Nothing to preview yet.</p>
          )}
        </div>
      </div>
      <p className="min-h-[1.25rem] text-sm" aria-live="polite">
        {error ? <span className="text-danger">{error}</span> : <span className="text-xs text-subtle">Supports **bold**, *italic*, ### headings, - lists and [links](https://example.com). HTML is shown as text.</span>}
      </p>
    </div>
  );
}
