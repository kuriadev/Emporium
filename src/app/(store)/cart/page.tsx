import type { Metadata } from "next";
import { CartPage } from "@/components/store/cart-page";
import { ProductRail } from "@/components/store/product-rail";
import { SectionHeading } from "@/components/ui/bits";
import { getCurrentUser } from "@/server/auth/session";
import { getFeatured } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function BagPage() {
  const user = await getCurrentUser();
  const picks = getFeatured(8);
  return (
    <div className="shell space-y-section pb-40 pt-8 lg:pb-section lg:pt-12">
      <div>
        <h1 className="mb-8 text-3xl font-light">Your bag</h1>
        <CartPage signedIn={user?.role === "customer"} />
      </div>
      <section aria-labelledby="picks-title" className="space-y-6">
        <SectionHeading id="picks-title" title="Complete the look" accent="Popular add-ons." />
        <ProductRail products={picks} label="Complete the look" />
      </section>
    </div>
  );
}
