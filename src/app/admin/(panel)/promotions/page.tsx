import type { Metadata } from "next";
import { PromoManager, type PromoRow } from "@/components/admin/promo-manager";
import { FilterLinks, PageHeader, StatTile, peso } from "@/components/admin/ui";
import { promoStatus, type PromoStatus } from "@/lib/promo-status";
import { requestTime } from "@/lib/clock";
import { requireAdminPage } from "@/server/auth/guards";
import { listPromos, promoTotals } from "@/server/services/admin";

export const metadata: Metadata = { title: "Promotions" };

type Props = { searchParams: Promise<{ status?: string; new?: string }> };

const FILTERS = { all: "All", live: "Live", scheduled: "Scheduled", paused: "Paused", ended: "Ended" } as const;
type Filter = keyof typeof FILTERS;
const ORDER: Record<PromoStatus, number> = { live: 0, scheduled: 1, paused: 2, used_up: 3, expired: 4 };
const matches = (f: Filter, s: PromoStatus) => f === "all" || (f === "ended" ? s === "expired" || s === "used_up" : s === f);

export default async function AdminPromotionsPage({ searchParams }: Props) {
  await requireAdminPage("promotions:write", "/admin/promotions");
  const sp = await searchParams;
  const filter: Filter = typeof sp.status === "string" && Object.hasOwn(FILTERS, sp.status) ? (sp.status as Filter) : "all";
  const now = requestTime();

  const promos = listPromos()
    .map(({ promo: p, orders, revenue, discount }): PromoRow & { status: PromoStatus } => {
      const row: PromoRow = {
        id: p.id,
        code: p.code,
        description: p.description,
        type: p.type,
        value: p.value,
        minSubtotal: p.minSubtotal,
        startsAt: p.startsAt?.getTime() ?? null,
        endsAt: p.endsAt?.getTime() ?? null,
        usageLimit: p.usageLimit,
        perUserLimit: p.perUserLimit,
        usedCount: p.usedCount,
        stackable: p.stackable,
        active: p.active,
        orders,
        revenue,
        discount,
      };
      return { ...row, status: promoStatus(row, now) };
    })
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.revenue - a.revenue);
  const totals = promoTotals();
  const live = promos.filter((p) => p.status === "live").length;
  const scheduled = promos.filter((p) => p.status === "scheduled").length;
  const href = (f: Filter) => (f === "all" ? "/admin/promotions" : `/admin/promotions?status=${f}`);

  return (
    <>
      <PageHeader eyebrow="Marketing" title="Promotions" description="Codes shoppers enter at checkout. Revenue counts paid orders net of refunds; an order with two codes counts under both." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Live codes" value={live} hint={scheduled ? `${scheduled} scheduled to start` : "None scheduled"} href={href("live")} />
        <StatTile label="Orders with a code" value={totals.orders} hint={totals.paidOrders ? `${Math.round((totals.orders / totals.paidOrders) * 100)}% of paid orders` : "No paid orders yet"} />
        <StatTile label="Revenue from those orders" value={peso(totals.revenue)} hint="Net of refunds" />
        <StatTile label="Discounts given" value={peso(totals.discount)} hint={totals.revenue ? `${((totals.discount / (totals.revenue + totals.discount)) * 100).toFixed(1)}% of pre-discount value` : "Nothing redeemed yet"} />
      </div>

      <PromoManager
        promos={promos.filter((p) => matches(filter, p.status)).map(({ status: _status, ...p }) => p)}
        startOpen={sp.new === "1"}
        toolbar={<FilterLinks label="Filter promotions" options={(Object.keys(FILTERS) as Filter[]).map((f) => ({ href: href(f), label: FILTERS[f], active: filter === f, count: promos.filter((p) => matches(f, p.status)).length }))} />}
      />
    </>
  );
}
