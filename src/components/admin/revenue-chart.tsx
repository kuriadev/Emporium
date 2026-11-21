"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface RevenuePoint {
  /** Label for the column (a day or the first day of a week), ISO yyyy-mm-dd. */
  day: string;
  revenue: number;
  orders: number;
}

const compact = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const dayFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Round the axis maximum up to 1/2/2.5/5 × 10ⁿ so tick labels stay clean. */
function niceMax(value: number): number {
  if (value <= 0) return 100_000;
  const exp = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 2.5, 5, 10]) if (value <= m * exp) return m * exp;
  return 10 * exp;
}

/** Column with a 4px rounded data-end and a square baseline. */
function columnPath(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  if (h <= 0 || w <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

const PAD = { top: 26, right: 8, bottom: 26, left: 52 };
const HEIGHT = 240;

/**
 * Net revenue per period as thin columns (one series, one brand hue validated against the dark
 * surface). Pointer and arrow keys snap to the nearest column; every value is also in the table.
 */
export function RevenueChart({ points, unit, title }: { points: RevenuePoint[]; unit: "day" | "week"; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const tableId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { max, ticks, peak } = useMemo(() => {
    const top = niceMax(Math.max(...points.map((p) => p.revenue), 0));
    return {
      max: top,
      ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => f * top),
      peak: points.reduce((best, p, i) => (p.revenue > (points[best]?.revenue ?? -1) ? i : best), 0),
    };
  }, [points]);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = points.length ? plotW / points.length : 0;
  const barW = Math.max(1, Math.min(24, band - 2));
  const xOf = (i: number) => PAD.left + i * band + (band - barW) / 2;
  const yOf = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const base = PAD.top + plotH;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 64))));
  const label = (p: RevenuePoint) => (unit === "week" ? `Week of ${dayFmt.format(asDate(p.day))}` : longFmt.format(asDate(p.day)));
  const current = active !== null ? points[active] : null;

  const snap = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !band) return;
    const i = Math.floor((clientX - rect.left - PAD.left) / band);
    setActive(Math.min(points.length - 1, Math.max(0, i)));
  };

  const tipLeft = active !== null ? Math.min(Math.max(xOf(active) + barW / 2, 80), Math.max(80, width - 80)) : 0;

  return (
    <div>
      <div
        ref={ref}
        role="group"
        tabIndex={0}
        aria-label={`${title}. Use the left and right arrow keys to read each ${unit}.`}
        aria-describedby={tableId}
        onPointerMove={(e) => snap(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            setActive((a) => {
              const start = a ?? (e.key === "ArrowRight" ? -1 : points.length);
              return Math.min(points.length - 1, Math.max(0, start + (e.key === "ArrowRight" ? 1 : -1)));
            });
          } else if (e.key === "Home") setActive(0);
          else if (e.key === "End") setActive(points.length - 1);
          else if (e.key === "Escape") setActive(null);
        }}
        className="relative h-[15rem] w-full touch-pan-y rounded-md outline-none focus-visible:ring-[0.1875rem] focus-visible:ring-accent"
        style={{ ["--viz-series" as string]: "#b174d4", ["--viz-series-active" as string]: "#d2a2e8" }}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="block overflow-visible" aria-hidden>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? "var(--color-line-strong)" : "var(--color-line)"} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={PAD.left - 8} y={yOf(t)} dy="0.32em" textAnchor="end" className="fill-subtle text-[0.6875rem] tabular-nums">
                  {compact.format(t / 100)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const d = columnPath(xOf(i), yOf(p.revenue), barW, base);
              if (!d) return null;
              return (
                <motion.path
                  key={p.day}
                  d={d}
                  fill={active === i ? "var(--viz-series-active)" : "var(--viz-series)"}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(i * 0.012, 0.3), ease: [0.2, 0.8, 0.2, 1] }}
                  style={{ transformOrigin: `0px ${base}px` }}
                />
              );
            })}
            {points[peak] && points[peak]!.revenue > 0 && (
              <text x={xOf(peak) + barW / 2} y={yOf(points[peak]!.revenue) - 8} textAnchor="middle" className="fill-muted text-[0.6875rem]">
                {compact.format(points[peak]!.revenue / 100)}
              </text>
            )}
            {points.map((p, i) =>
              i % labelEvery === 0 ? (
                <text key={p.day} x={xOf(i) + barW / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-subtle text-[0.6875rem]">
                  {dayFmt.format(asDate(p.day))}
                </text>
              ) : null,
            )}
            {active !== null && <line x1={xOf(active) + barW / 2} x2={xOf(active) + barW / 2} y1={PAD.top} y2={base} stroke="var(--color-line-strong)" strokeWidth={1} />}
          </svg>
        )}
        {current && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-line-strong bg-surface-2/95 px-3 py-2 text-left shadow-lg backdrop-blur"
            style={{ left: tipLeft }}
          >
            <p className="text-sm text-fg">{full.format(current.revenue / 100)}</p>
            <p className="flex items-center gap-1.5 text-2xs text-muted">
              <span aria-hidden className="inline-block h-[0.125rem] w-3 rounded-pill bg-[var(--viz-series)]" />
              {label(current)} · {current.orders} {current.orders === 1 ? "order" : "orders"}
            </p>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {current ? `${label(current)}: ${full.format(current.revenue / 100)} from ${current.orders} orders` : ""}
      </p>
      <details id={tableId} className="mt-3 text-sm">
        <summary className="inline-flex min-h-tap cursor-pointer items-center text-muted hover:text-fg">View as table</summary>
        <div className="relative mt-2 max-h-[18rem] overflow-y-auto rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface text-xs text-subtle">
              <tr>
                <th scope="col" className="px-3 py-2 font-normal">
                  {unit === "week" ? "Week of" : "Day"}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Orders
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Net revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {points.map((p, i) => (
                <tr key={p.day} className={cn(i === peak && p.revenue > 0 && "text-fg")}>
                  <td className="px-3 py-2 text-muted">{longFmt.format(asDate(p.day))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{p.orders}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{full.format(p.revenue / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
