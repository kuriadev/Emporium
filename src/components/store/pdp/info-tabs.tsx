"use client";

import { motion } from "framer-motion";
import { Tabs } from "radix-ui";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/lib/pricing";

export interface SpecRow {
  label: string;
  value: string;
}

/** Details / Specs / Shipping tabs. Description HTML is produced server-side by the escape-first markdown renderer. */
export function InfoTabs({ descriptionHtml, specs }: { descriptionHtml: string; specs: SpecRow[] }) {
  const [tab, setTab] = useState("details");
  const tabs = [
    { id: "details", label: "Details" },
    { id: "specs", label: "Specs" },
    { id: "shipping", label: "Shipping & returns" },
  ];
  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List aria-label="Product information" className="relative flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {tabs.map((t) => (
          <Tabs.Trigger key={t.id} value={t.id} className="relative min-h-tap shrink-0 px-4 text-sm text-muted transition hover:text-fg data-[state=active]:text-fg">
            {t.label}
            {tab === t.id && <motion.span layoutId="pdp-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-pill bg-fg" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="details" className="prose-safe max-w-[44rem] pt-6" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />

      <Tabs.Content value="specs" className="pt-6">
        <dl className="grid max-w-[44rem] grid-cols-1 divide-y divide-line rounded-lg border border-line">
          {specs.map((s) => (
            <div key={s.label} className="grid grid-cols-[minmax(7rem,12rem)_1fr] gap-4 px-4 py-3 text-sm">
              <dt className="text-muted">{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </Tabs.Content>

      <Tabs.Content value="shipping" className="max-w-[44rem] space-y-4 pt-6 text-sm text-muted">
        <p>
          <span className="text-fg">Shipping.</span> Standard delivery takes {SHIPPING_RATES.standard.minDays} to {SHIPPING_RATES.standard.maxDays} business days ({formatMoney(SHIPPING_RATES.standard.fee)}, free over{" "}
          {formatMoney(FREE_SHIPPING_THRESHOLD)}). Express takes {SHIPPING_RATES.express.minDays} to {SHIPPING_RATES.express.maxDays} business days ({formatMoney(SHIPPING_RATES.express.fee)}). Every order ships with a tracking number you
          can follow from your order page.
        </p>
        <p>
          <span className="text-fg">Returns.</span> Changed your mind? Request a return within 30 days of delivery from the order page. Items must be unused and in their original packaging. Refunds go back to the original payment method
          within 5 to 7 business days after we receive the item.
        </p>
        <p>
          <span className="text-fg">Cancellations.</span> Orders can be cancelled any time before they ship, straight from your account.
        </p>
      </Tabs.Content>
    </Tabs.Root>
  );
}
