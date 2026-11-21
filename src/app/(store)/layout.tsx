import { Suspense } from "react";
import { MobileDock } from "@/components/layout/mobile-dock";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { StoreShell } from "@/components/store/store-shell";
import { getCurrentUser } from "@/server/auth/session";
import { getFeatured } from "@/server/services/catalog";
import { listOrdersForUser } from "@/server/services/orders";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const customer = user?.role === "customer" ? user : null;
  const orders = customer ? listOrdersForUser(customer.id).slice(0, 5).map((o) => ({ id: o.id, number: o.number, status: o.status })) : [];

  return (
    <>
      <Suspense fallback={<div className="h-[4.5rem]" />}>
        <SiteHeader user={customer ? { name: customer.name } : null} />
      </Suspense>
      <main id="main" className="min-h-[70dvh] pt-[6.5rem] lg:pt-[4.5rem]">
        {children}
      </main>
      <SiteFooter />
      <MobileDock signedIn={!!customer} />
      <StoreShell bestsellers={getFeatured(4)} orders={orders} />
    </>
  );
}
