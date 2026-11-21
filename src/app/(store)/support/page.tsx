import { Clock, Mail, PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SupportForm } from "@/components/store/support-form";
import { formatMoney } from "@/lib/money";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Support", description: "Order help, returns and product questions. Real people reply within one business day." };

const FAQ = [
  { q: "How do I track my order?", a: "Open Account, then Orders, and pick the order. Once it ships you'll see the courier, tracking number and every status change on a timeline." },
  { q: "Can I cancel an order?", a: "Yes, any time before it ships. Open the order and choose Cancel order; stock is released and you're refunded to the original payment method." },
  { q: "What is your return policy?", a: "You have 30 days from delivery. Start the return from the order page, pack the item unused in its original box, and we'll arrange pickup." },
  { q: "How much is shipping?", a: `Standard is ₱120 (3 to 5 business days) and Express is ₱250 (1 to 2 business days). Standard shipping is free on orders over ${formatMoney(FREE_SHIPPING_THRESHOLD)}.` },
  { q: "Do prices include VAT?", a: "Yes. Every price on Emporium includes 12% VAT, and your receipt shows the VAT portion separately." },
  { q: "Which promo codes can I combine?", a: "You can use up to two codes per order, but only codes marked stackable combine (for example FREESHIP with WELCOME10). The checkout tells you exactly why a code didn't apply." },
];

export default async function SupportPage() {
  const user = await getCurrentUser();
  const defaults = user?.role === "customer" ? { name: user.name, email: user.email } : { name: "Alex Rivera", email: "alex.rivera@example.com" };
  return (
    <div className="shell grid gap-12 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:py-12">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-light">How can we help?</h1>
          <p className="mt-2 max-w-[32rem] text-muted">Most answers are below. If not, send us a note and a real person will get back to you.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <li className="rounded-lg border border-line p-4">
            <Clock className="size-5 text-price" aria-hidden />
            <p className="mt-2 text-sm">Replies within 1 business day</p>
          </li>
          <li className="rounded-lg border border-line p-4">
            <PackageSearch className="size-5 text-price" aria-hidden />
            <p className="mt-2 text-sm">
              <Link href="/account" className="underline-offset-4 hover:underline">
                Track an order
              </Link>
            </p>
          </li>
          <li className="rounded-lg border border-line p-4">
            <Mail className="size-5 text-price" aria-hidden />
            <p className="mt-2 text-sm">support@emporium.test</p>
          </li>
        </ul>
        <section aria-labelledby="faq-title">
          <h2 id="faq-title" className="mb-4 text-xl">
            Frequently asked
          </h2>
          <div className="divide-y divide-line rounded-lg border border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-4 py-3">
                  {f.q}
                  <span aria-hidden className="text-xl text-muted transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-4 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
      <SupportForm defaults={defaults} />
    </div>
  );
}
