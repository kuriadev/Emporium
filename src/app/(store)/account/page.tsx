import { ChevronRight, Download, Heart, LogOut, Package } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AddressManager, ChangePasswordForm, DeleteAccountForm } from "@/components/account/account-forms";
import { Badge } from "@/components/ui/bits";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatDate, formatMoney } from "@/lib/money";
import { STATUS_LABEL, type OrderStatusValue } from "@/lib/order-state";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";
import { requireUserPage } from "@/server/auth/guards";
import { listAddresses } from "@/server/services/account";
import { listWishlist } from "@/server/services/cart";
import { listOrdersForUser } from "@/server/services/orders";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const TONE: Record<OrderStatusValue, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  pending: "warning",
  paid: "accent",
  packed: "accent",
  shipped: "accent",
  delivered: "success",
  cancelled: "danger",
  refunded: "neutral",
};

const SECTIONS = [
  { id: "orders", label: "Orders" },
  { id: "addresses", label: "Addresses" },
  { id: "security", label: "Security" },
  { id: "privacy", label: "Privacy & data" },
];

export default async function AccountPage() {
  const user = await requireUserPage("/account");
  if (user.role !== "customer")
    return (
      <div className="shell py-16 text-center">
        <h1 className="text-3xl font-light">You&apos;re signed in as staff</h1>
        <Link href="/admin" className={cn(buttonVariants(), "mt-6")}>
          Go to admin
        </Link>
      </div>
    );
  const orders = listOrdersForUser(user.id);
  const addresses = listAddresses(user.id);
  const wishCount = listWishlist(`u:${user.id}`).length;
  const lifetime = orders.filter((o) => o.status !== "cancelled").reduce((a, o) => a + o.total - o.refundedAmount, 0);
  const open = orders.filter((o) => ["pending", "paid", "packed", "shipped"].includes(o.status)).length;

  return (
    <div className="shell pb-36 pt-8 lg:pb-section lg:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-2xs uppercase tracking-[0.3em] text-subtle">Member since {formatDate(user.createdAt, { month: "long", year: "numeric" })}</p>
          <h1 className="mt-1 text-3xl font-light">Hi, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </form>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Orders", value: String(orders.length) },
          { label: "In progress", value: String(open) },
          { label: "Lifetime spend", value: formatMoney(lifetime) },
          { label: "Wishlist", value: String(wishCount), href: "/wishlist" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-line p-4">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl tabular-nums">{s.href ? <Link href={s.href} className="inline-flex items-center gap-2 hover:text-accent">{s.value} <Heart className="size-4" aria-hidden /></Link> : s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Account sections" className="-mx-gutter overflow-x-auto px-gutter lg:mx-0 lg:px-0">
          <ul className="flex gap-2 lg:sticky lg:top-24 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-tap shrink-0 items-center rounded-pill border border-line px-4 text-sm text-muted transition hover:border-fg hover:text-fg lg:w-full lg:rounded-md lg:border-transparent">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-14">
          <section id="orders" aria-labelledby="orders-title" className="scroll-mt-28">
            <h2 id="orders-title" className="mb-4 text-xl">
              Order history
            </h2>
            {orders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">
                <Package className="mx-auto size-8" aria-hidden />
                <p className="mt-3">No orders yet.</p>
                <Link href="/products" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
                  Start shopping
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="group flex items-center gap-4 p-4 transition hover:bg-white/5">
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-white">{o.thumb && <Image src={o.thumb} alt="" fill sizes="3.5rem" className="object-cover" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm">{o.number}</span>
                          <Badge tone={TONE[o.status as OrderStatusValue]}>{STATUS_LABEL[o.status as OrderStatusValue]}</Badge>
                          {o.returnStatus !== "none" && <Badge tone="warning">Return {o.returnStatus}</Badge>}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {formatDate(o.createdAt)} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                          {o.trackingNumber ? ` · ${o.carrier ?? "Courier"} ${o.trackingNumber}` : ""}
                        </span>
                      </span>
                      <span className="text-right tabular-nums">{formatMoney(o.total)}</span>
                      <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-1" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="addresses" aria-labelledby="addresses-title" className="scroll-mt-28">
            <h2 id="addresses-title" className="mb-4 text-xl">
              Saved addresses
            </h2>
            <AddressManager
              name={user.name}
              phone={user.phone ?? ""}
              addresses={addresses.map((a) => ({ id: a.id, label: a.label, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, province: a.province, postalCode: a.postalCode, isDefault: a.isDefault }))}
            />
          </section>

          <section id="security" aria-labelledby="security-title" className="scroll-mt-28">
            <h2 id="security-title" className="mb-1 text-xl">
              Security
            </h2>
            <p className="mb-4 text-sm text-muted">Changing your password signs out every other device.</p>
            <ChangePasswordForm />
          </section>

          <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-28 space-y-4">
            <h2 id="privacy-title" className="text-xl">
              Privacy &amp; data
            </h2>
            <p className="max-w-[40rem] text-sm text-muted">Download a machine-readable copy of everything we store about you (profile, addresses, orders, reviews and wishlist), or delete your account.</p>
            <a href="/api/account/export" className={buttonVariants({ variant: "outline" })} download>
              <Download className="size-4" aria-hidden /> Download my data (JSON)
            </a>
            <DeleteAccountForm />
          </section>
        </div>
      </div>
    </div>
  );
}
