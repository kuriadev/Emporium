import { formatMoney } from "@/lib/money";

const MONEY_KEY = /(amount|price|total|subtotal|fee|discount|basePrice|priceOverride|minSubtotal)$/i;

function show(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "number" && MONEY_KEY.test(key)) return formatMoney(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Renders an audit entry's changed fields as old → new pairs (strings are escaped by React). */
export function AuditDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (!keys.length) return null;
  return (
    <dl className="grid gap-1 text-xs">
      {keys.map((key) => {
        const b = before ? show(key, before[key]) : null;
        const a = after ? show(key, after[key]) : null;
        return (
          <div key={key} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <dt className="text-subtle">{key}</dt>
            {b !== null && (
              <dd className="max-w-full break-all text-danger line-through decoration-danger/60">
                <span className="sr-only">from </span>
                {b}
              </dd>
            )}
            {b !== null && a !== null && <span aria-hidden className="text-subtle">→</span>}
            {a !== null && (
              <dd className="max-w-full break-all text-success">
                <span className="sr-only">to </span>
                {a}
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
