/** Shared (client + server) presentation rules for promo codes. Eligibility is enforced in server/services/promo.ts. */

export type PromoType = "percent" | "fixed" | "free_shipping";
export type PromoStatus = "live" | "scheduled" | "paused" | "used_up" | "expired";

export interface PromoLike {
  type: PromoType;
  value: number;
  active: boolean;
  startsAt: number | null;
  endsAt: number | null;
  usageLimit: number | null;
  usedCount: number;
}

export const PROMO_STATUS_LABEL: Record<PromoStatus, string> = {
  live: "Live",
  scheduled: "Scheduled",
  paused: "Paused",
  used_up: "Fully redeemed",
  expired: "Expired",
};

export const PROMO_STATUS_TONE: Record<PromoStatus, "success" | "accent" | "warning" | "neutral" | "danger"> = {
  live: "success",
  scheduled: "accent",
  paused: "warning",
  used_up: "neutral",
  expired: "neutral",
};

/** Mirrors the order of checks shoppers hit at checkout, so staff see the same answer. */
export function promoStatus(p: PromoLike, now: number = Date.now()): PromoStatus {
  if (!p.active) return "paused";
  if (p.endsAt !== null && p.endsAt < now) return "expired";
  if (p.startsAt !== null && p.startsAt > now) return "scheduled";
  if (p.usageLimit !== null && p.usedCount >= p.usageLimit) return "used_up";
  return "live";
}

const pesos = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

/** "15% off", "₱300 off", "Free shipping". `value` is a percent or centavos, as stored. */
export function promoValueLabel(type: PromoType, value: number): string {
  if (type === "percent") return `${value}% off`;
  if (type === "fixed") return `${pesos.format(value / 100)} off`;
  return "Free shipping";
}

const MANILA_OFFSET_MS = 8 * 3_600_000;

/** Epoch ms → "YYYY-MM-DDTHH:mm" Manila wall time for <input type="datetime-local">. Manila has no DST. */
export function toManilaInput(ms: number | null): string {
  return ms === null ? "" : new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" Manila wall time → ISO string with an explicit +08:00 offset ("" stays ""). */
export function fromManilaInput(value: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+08:00` : "";
}
