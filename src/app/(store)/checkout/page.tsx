import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/store/checkout/checkout-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { requireUserPage } from "@/server/auth/guards";
import { listAddresses } from "@/server/services/account";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUserPage("/checkout");
  if (user.role !== "customer")
    return (
      <div className="shell py-16 text-center">
        <h1 className="text-3xl font-light">Staff accounts can&apos;t place orders</h1>
        <p className="mt-2 text-muted">Sign in with a customer account to test checkout.</p>
        <Link href="/admin" className={`${buttonVariants({ variant: "outline" })} mt-6`}>
          Back to admin
        </Link>
      </div>
    );
  const addresses = listAddresses(user.id).map((a) => ({
    id: a.id,
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    province: a.province,
    postalCode: a.postalCode,
    isDefault: a.isDefault,
  }));
  return (
    <div className="shell pb-40 pt-8 lg:pb-section lg:pt-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-light">Checkout</h1>
        <p className="flex items-center gap-2 text-sm text-muted">
          <Lock className="size-4 text-price" aria-hidden /> Encrypted connection · prices re-checked on our servers
        </p>
      </div>
      <CheckoutForm email={user.email} name={user.name} addresses={addresses} />
    </div>
  );
}
