import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { computeTotals, type PricingPromo, type ShippingTierKey } from "@/lib/pricing";
import type { CartLineView, CartView } from "@/lib/types";
import { MAX_LINE_QTY } from "@/lib/validations/commerce";
import { getDb, schema } from "../db";
import { BUNDLES } from "../db/catalog-data";
import { variantPrice } from "./catalog";

export const variantLabel = (v: Pick<schema.ProductVariant, "color" | "size" | "material">) =>
  [v.color, v.size, v.material].filter(Boolean).join(" · ") || "Standard";

export function loadCartLines(ownerKey: string | null): { lines: CartLineView[]; issues: string[] } {
  if (!ownerKey) return { lines: [], issues: [] };
  const db = getDb();
  const rows = db
    .select({ item: schema.cartItems, variant: schema.productVariants, product: schema.products })
    .from(schema.cartItems)
    .innerJoin(schema.productVariants, eq(schema.productVariants.id, schema.cartItems.variantId))
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(eq(schema.cartItems.ownerKey, ownerKey))
    .orderBy(schema.cartItems.createdAt)
    .all();

  const issues: string[] = [];
  const lines: CartLineView[] = [];
  for (const { item, variant, product } of rows) {
    if (product.status !== "active") {
      issues.push(`${product.name} is no longer available and was removed.`);
      db.delete(schema.cartItems).where(eq(schema.cartItems.id, item.id)).run();
      continue;
    }
    let quantity = item.quantity;
    if (variant.stock <= 0) {
      issues.push(`${product.name} (${variantLabel(variant)}) just sold out.`);
      quantity = 0;
    } else if (quantity > variant.stock) {
      issues.push(`Only ${variant.stock} left of ${product.name}; quantity adjusted.`);
      quantity = variant.stock;
      db.update(schema.cartItems).set({ quantity, updatedAt: new Date() }).where(eq(schema.cartItems.id, item.id)).run();
    }
    const unitPrice = variantPrice(product, variant);
    lines.push({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantLabel: variantLabel(variant),
      image: product.images[0] ?? null,
      unitPrice,
      quantity,
      stock: variant.stock,
      lineTotal: unitPrice * quantity,
      tierPricing: product.tierPricing,
    });
  }
  return { lines, issues };
}

export function buildCartView(
  ownerKey: string | null,
  opts: { promos?: PricingPromo[]; shippingTier?: ShippingTierKey; giftWrap?: boolean } = {},
): CartView {
  const { lines, issues } = loadCartLines(ownerKey);
  const totals = computeTotals({
    lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, unitPrice: l.unitPrice, quantity: l.quantity, tierPricing: l.tierPricing })),
    bundles: BUNDLES,
    promos: opts.promos,
    shippingTier: opts.shippingTier,
    giftWrap: opts.giftWrap,
  });
  return {
    lines,
    itemCount: lines.reduce((a, l) => a + l.quantity, 0),
    totals,
    appliedBundles: BUNDLES.filter((b) => totals.appliedBundles.includes(b.id)).map(({ id, title, pct }) => ({ id, title, pct })),
    issues,
  };
}

export class CartError extends Error {}

export function setCartQuantity(ownerKey: string, variantId: string, quantity: number, mode: "set" | "add"): void {
  const db = getDb();
  db.transaction((tx) => {
    const variant = tx
      .select({ v: schema.productVariants, status: schema.products.status })
      .from(schema.productVariants)
      .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
      .where(eq(schema.productVariants.id, variantId))
      .get();
    if (!variant || variant.status !== "active") throw new CartError("This item is unavailable.");

    const existing = tx
      .select()
      .from(schema.cartItems)
      .where(and(eq(schema.cartItems.ownerKey, ownerKey), eq(schema.cartItems.variantId, variantId)))
      .get();
    const target = mode === "add" ? (existing?.quantity ?? 0) + quantity : quantity;

    if (target <= 0) {
      if (existing) tx.delete(schema.cartItems).where(eq(schema.cartItems.id, existing.id)).run();
      return;
    }
    if (variant.v.stock <= 0) throw new CartError("Sorry, this item just sold out.");
    if (target > variant.v.stock) throw new CartError(`Only ${variant.v.stock} left in stock.`);
    if (target > MAX_LINE_QTY) throw new CartError(`Limit ${MAX_LINE_QTY} per item.`);

    if (existing) tx.update(schema.cartItems).set({ quantity: target, updatedAt: new Date() }).where(eq(schema.cartItems.id, existing.id)).run();
    else tx.insert(schema.cartItems).values({ id: randomUUID(), ownerKey, variantId, quantity: target }).run();
  });
}

/** Guest → account merge: quantities are summed, then clamped to stock and the per-line limit. */
export function mergeOwner(from: string, to: string): void {
  if (from === to) return;
  const db = getDb();
  db.transaction((tx) => {
    const guestItems = tx.select().from(schema.cartItems).where(eq(schema.cartItems.ownerKey, from)).all();
    if (guestItems.length) {
      const stock = new Map(
        tx
          .select({ id: schema.productVariants.id, stock: schema.productVariants.stock })
          .from(schema.productVariants)
          .where(inArray(schema.productVariants.id, guestItems.map((i) => i.variantId)))
          .all()
          .map((v) => [v.id, v.stock]),
      );
      for (const item of guestItems) {
        const mine = tx
          .select()
          .from(schema.cartItems)
          .where(and(eq(schema.cartItems.ownerKey, to), eq(schema.cartItems.variantId, item.variantId)))
          .get();
        const qty = Math.min((mine?.quantity ?? 0) + item.quantity, stock.get(item.variantId) ?? 0, MAX_LINE_QTY);
        if (mine) tx.update(schema.cartItems).set({ quantity: qty, updatedAt: new Date() }).where(eq(schema.cartItems.id, mine.id)).run();
        else if (qty > 0) tx.insert(schema.cartItems).values({ id: randomUUID(), ownerKey: to, variantId: item.variantId, quantity: qty }).run();
      }
      tx.delete(schema.cartItems).where(eq(schema.cartItems.ownerKey, from)).run();
    }

    tx.run(
      sql`INSERT OR IGNORE INTO wishlist_items (id, owner_key, product_id, created_at)
          SELECT lower(hex(randomblob(16))), ${to}, product_id, created_at FROM wishlist_items WHERE owner_key = ${from}`,
    );
    tx.delete(schema.wishlistItems).where(eq(schema.wishlistItems.ownerKey, from)).run();
  });
}

export function listWishlist(ownerKey: string | null): string[] {
  if (!ownerKey) return [];
  return getDb()
    .select({ productId: schema.wishlistItems.productId })
    .from(schema.wishlistItems)
    .where(eq(schema.wishlistItems.ownerKey, ownerKey))
    .all()
    .map((r) => r.productId);
}

export function toggleWishlist(ownerKey: string, productId: string, on: boolean): void {
  const db = getDb();
  if (on) {
    const exists = db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, productId)).get();
    if (!exists) throw new CartError("Product not found.");
    db.insert(schema.wishlistItems).values({ id: randomUUID(), ownerKey, productId }).onConflictDoNothing().run();
  } else {
    db.delete(schema.wishlistItems).where(and(eq(schema.wishlistItems.ownerKey, ownerKey), eq(schema.wishlistItems.productId, productId))).run();
  }
}
