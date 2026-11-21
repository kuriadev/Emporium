import type { Metadata } from "next";
import { WishlistGrid } from "@/components/store/wishlist-grid";
import { readOwnerKey } from "@/server/auth/session";
import { listWishlist } from "@/server/services/cart";
import { getProductsByIds } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function WishlistPage() {
  const ids = listWishlist(await readOwnerKey());
  const products = getProductsByIds(ids);
  return (
    <div className="shell py-8 lg:py-12">
      <h1 className="text-3xl font-light">Wishlist</h1>
      <p className="mt-1 text-sm text-muted">Saved items stay with you across devices once you sign in.</p>
      <div className="mt-8">
        <WishlistGrid initial={products} />
      </div>
    </div>
  );
}
