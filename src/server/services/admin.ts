import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, getTableColumns, gte, inArray, lt, lte, ne, notInArray, sql } from "drizzle-orm";
import type { ProductData } from "@/lib/validations/admin";
import { getDb, schema } from "../db";
import { writeAudit } from "./audit";

type Actor = { id: string; email: string };
const DAY = 86_400_000;

const MANILA_OFFSET_MS = 8 * 3_600_000;
const manilaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
export const DASHBOARD_RANGES = [7, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

/**
 * Headline numbers for the last `days` Manila calendar days (today included) against the
 * `days` before that. Revenue is net of refunds; cancelled/unpaid orders never count.
 */
export function dashboardKpis(days: DashboardRange = 30) {
  const db = getDb();
  const now = Date.now();
  const todayStart = Math.floor((now + MANILA_OFFSET_MS) / DAY) * DAY - MANILA_OFFSET_MS;
  const since = new Date(todayStart - (days - 1) * DAY);
  const prev = new Date(since.getTime() - days * DAY);
  const revenueStatuses = ["paid", "packed", "shipped", "delivered"] as const;

  const window = (from: Date, to: Date) =>
    db
      .select({
        revenue: sql<number>`coalesce(sum(${schema.orders.total} - ${schema.orders.refundedAmount}), 0)`,
        orders: sql<number>`count(*)`,
        customers: sql<number>`count(distinct ${schema.orders.userId})`,
      })
      .from(schema.orders)
      .where(and(inArray(schema.orders.status, revenueStatuses), gte(schema.orders.createdAt, from), lt(schema.orders.createdAt, to)))
      .get() ?? { revenue: 0, orders: 0, customers: 0 };

  const current = window(since, new Date(now + DAY));
  const previous = window(prev, since);
  const lowStock = db
    .select({ n: sql<number>`count(*)` })
    .from(schema.productVariants)
    .where(lte(schema.productVariants.stock, schema.productVariants.reorderThreshold))
    .get();
  const pending = db
    .select({ n: sql<number>`count(*)` })
    .from(schema.orders)
    .where(inArray(schema.orders.status, ["pending", "paid", "packed"]))
    .get();
  const returns = db.select({ n: sql<number>`count(*)` }).from(schema.orders).where(eq(schema.orders.returnStatus, "requested")).get();

  const rows = db
    .select({
      day: sql<string>`strftime('%Y-%m-%d', ${schema.orders.createdAt} / 1000, 'unixepoch', '+8 hours')`,
      revenue: sql<number>`sum(${schema.orders.total} - ${schema.orders.refundedAmount})`,
      orders: sql<number>`count(*)`,
    })
    .from(schema.orders)
    .where(and(inArray(schema.orders.status, revenueStatuses), gte(schema.orders.createdAt, since)))
    .groupBy(sql`1`)
    .all();
  const byDay = new Map(rows.map((r) => [r.day, r]));
  // Every calendar day in the window, zero-filled, so the chart and the totals always agree.
  const daily = Array.from({ length: days }, (_, i) => {
    const day = manilaDay.format(new Date(since.getTime() + i * DAY + MANILA_OFFSET_MS / 2));
    return { day, revenue: byDay.get(day)?.revenue ?? 0, orders: byDay.get(day)?.orders ?? 0 };
  });

  const delta = (cur: number, before: number) => (before ? (cur - before) / before : null);
  return {
    days,
    revenue: current.revenue,
    revenueDelta: delta(current.revenue, previous.revenue),
    orders: current.orders,
    ordersDelta: delta(current.orders, previous.orders),
    activeCustomers: current.customers,
    customersDelta: delta(current.customers, previous.customers),
    aov: current.orders ? Math.round(current.revenue / current.orders) : 0,
    aovDelta: delta(current.orders ? current.revenue / current.orders : 0, previous.orders ? previous.revenue / previous.orders : 0),
    lowStock: lowStock?.n ?? 0,
    openOrders: pending?.n ?? 0,
    returnRequests: returns?.n ?? 0,
    daily,
  };
}

/** Orders per fulfilment stage that still need a human. */
export function fulfilmentQueue() {
  const rows = getDb()
    .select({ status: schema.orders.status, n: sql<number>`count(*)`, oldest: sql<number>`min(${schema.orders.createdAt})` })
    .from(schema.orders)
    .where(inArray(schema.orders.status, ["pending", "paid", "packed", "shipped"]))
    .groupBy(schema.orders.status)
    .all();
  return Object.fromEntries(rows.map((r) => [r.status, { n: r.n, oldest: r.oldest }])) as Partial<Record<"pending" | "paid" | "packed" | "shipped", { n: number; oldest: number }>>;
}

/** Badge counts for the admin navigation. */
export function adminNavCounts() {
  const db = getDb();
  const open = db.select({ n: sql<number>`count(*)` }).from(schema.orders).where(inArray(schema.orders.status, ["paid", "packed"])).get();
  const returns = db.select({ n: sql<number>`count(*)` }).from(schema.orders).where(eq(schema.orders.returnStatus, "requested")).get();
  const low = db.select({ n: sql<number>`count(*)` }).from(schema.productVariants).where(lte(schema.productVariants.stock, schema.productVariants.reorderThreshold)).get();
  return { orders: (open?.n ?? 0) + (returns?.n ?? 0), products: low?.n ?? 0 };
}

export function restockQueue(limit = 20) {
  return getDb()
    .select({
      variantId: schema.productVariants.id,
      sku: schema.productVariants.sku,
      stock: schema.productVariants.stock,
      threshold: schema.productVariants.reorderThreshold,
      productName: schema.products.name,
      productId: schema.products.id,
      alerts: sql<number>`(select count(*) from restock_alerts ra where ra.variant_id = "product_variants"."id" and ra.notified_at is null)`,
    })
    .from(schema.productVariants)
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(lte(schema.productVariants.stock, schema.productVariants.reorderThreshold))
    .orderBy(schema.productVariants.stock)
    .limit(limit)
    .all();
}

export function zeroResultSearches(limit = 6, days = 30) {
  return getDb()
    .select({ query: schema.searchQueries.query, n: sql<number>`count(*)`, last: sql<number>`max(${schema.searchQueries.createdAt})` })
    .from(schema.searchQueries)
    .where(and(eq(schema.searchQueries.resultCount, 0), gte(schema.searchQueries.createdAt, new Date(Date.now() - days * DAY))))
    .groupBy(schema.searchQueries.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
    .all();
}

export function abandonedCartItems(limit = 6) {
  return getDb()
    .select({
      productName: schema.products.name,
      sku: schema.productVariants.sku,
      carts: sql<number>`count(distinct ${schema.cartItems.ownerKey})`,
      units: sql<number>`sum(${schema.cartItems.quantity})`,
      value: sql<number>`sum(${schema.cartItems.quantity} * coalesce(${schema.productVariants.priceOverride}, ${schema.products.basePrice}))`,
    })
    .from(schema.cartItems)
    .innerJoin(schema.productVariants, eq(schema.productVariants.id, schema.cartItems.variantId))
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(lt(schema.cartItems.updatedAt, new Date(Date.now() - DAY)))
    .groupBy(schema.productVariants.id)
    .orderBy(desc(sql`count(distinct ${schema.cartItems.ownerKey})`))
    .limit(limit)
    .all();
}

export function listAdminProducts(q = "", status = "") {
  const db = getDb();
  const products = db.select().from(schema.products).orderBy(desc(schema.products.updatedAt)).all();
  const variants = db.select().from(schema.productVariants).all();
  const byProduct = Map.groupBy(variants, (v) => v.productId);
  const needle = q.trim().toLowerCase();
  return products
    .filter((p) => !status || p.status === status)
    .filter((p) => !needle || `${p.name} ${p.brand} ${p.slug}`.toLowerCase().includes(needle) || (byProduct.get(p.id) ?? []).some((v) => v.sku.toLowerCase().includes(needle)))
    .map((p) => {
      const vs = byProduct.get(p.id) ?? [];
      return {
        ...p,
        variants: vs,
        totalStock: vs.reduce((a, v) => a + v.stock, 0),
        lowStock: vs.some((v) => v.stock <= v.reorderThreshold),
      };
    });
}

export type AdminProduct = ReturnType<typeof listAdminProducts>[number];

const productSnapshot = (p: schema.Product, variants: schema.ProductVariant[]) => ({
  name: p.name,
  slug: p.slug,
  status: p.status,
  basePrice: p.basePrice,
  compareAtPrice: p.compareAtPrice,
  category: p.category,
  featured: p.featured,
  variants: Object.fromEntries(variants.map((v) => [v.sku, { stock: v.stock, priceOverride: v.priceOverride }])),
});

export class AdminError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

export function upsertProduct(actor: Actor, data: ProductData): string {
  const db = getDb();
  return db.transaction((tx) => {
    const slugOwner = tx.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, data.slug)).get();
    if (slugOwner && slugOwner.id !== data.id) throw new AdminError("Another product already uses this slug.", "slug");
    const skuClash = tx
      .select({ sku: schema.productVariants.sku, productId: schema.productVariants.productId })
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.sku, data.variants.map((v) => v.sku)))
      .all()
      .find((v) => v.productId !== data.id);
    if (skuClash) throw new AdminError(`SKU ${skuClash.sku} belongs to another product.`, "variants");

    const id = data.id ?? `prd_${randomUUID().slice(0, 12)}`;
    const before = data.id ? tx.select().from(schema.products).where(eq(schema.products.id, data.id)).get() : undefined;
    if (data.id && !before) throw new AdminError("Product not found.");
    const beforeVariants = data.id ? tx.select().from(schema.productVariants).where(eq(schema.productVariants.productId, data.id)).all() : [];

    const values = {
      name: data.name,
      slug: data.slug,
      brand: data.brand,
      category: data.category,
      tagline: data.tagline,
      description: data.description,
      basePrice: data.basePrice,
      compareAtPrice: data.compareAtPrice,
      status: data.status,
      featured: data.featured,
      tierPricing: data.tierPricing,
      materials: data.materials,
      dimensions: data.dimensions,
      images: data.images,
      updatedAt: new Date(),
    };
    if (before) tx.update(schema.products).set(values).where(eq(schema.products.id, id)).run();
    else tx.insert(schema.products).values({ id, ...values }).run();

    const keepIds: string[] = [];
    for (const v of data.variants) {
      const row = {
        sku: v.sku,
        color: v.color || null,
        colorHex: v.colorHex || null,
        size: v.size || null,
        material: v.material || null,
        priceOverride: v.priceOverride,
        stock: v.stock,
        reorderThreshold: v.reorderThreshold,
      };
      const existing = beforeVariants.find((b) => b.id === v.id || b.sku === v.sku);
      if (existing) {
        tx.update(schema.productVariants).set({ ...row, version: existing.version + 1 }).where(eq(schema.productVariants.id, existing.id)).run();
        keepIds.push(existing.id);
      } else {
        const vid = randomUUID();
        tx.insert(schema.productVariants).values({ id: vid, productId: id, ...row }).run();
        keepIds.push(vid);
      }
    }
    if (before) {
      const removed = beforeVariants.filter((b) => !keepIds.includes(b.id));
      if (removed.length) {
        const referenced = tx
          .select({ id: schema.orderItems.variantId })
          .from(schema.orderItems)
          .where(inArray(schema.orderItems.variantId, removed.map((r) => r.id)))
          .all();
        if (referenced.length) {
          tx.update(schema.productVariants).set({ stock: 0 }).where(inArray(schema.productVariants.id, referenced.map((r) => r.id!))).run();
        }
        tx.delete(schema.productVariants)
          .where(and(eq(schema.productVariants.productId, id), notInArray(schema.productVariants.id, [...keepIds, ...referenced.map((r) => r.id!)])))
          .run();
      }
    }

    const after = tx.select().from(schema.products).where(eq(schema.products.id, id)).get()!;
    const afterVariants = tx.select().from(schema.productVariants).where(eq(schema.productVariants.productId, id)).all();
    writeAudit(
      {
        actor,
        action: before ? "product.update" : "product.create",
        entityType: "product",
        entityId: id,
        before: before ? productSnapshot(before, beforeVariants) : null,
        after: productSnapshot(after, afterVariants),
      },
      tx,
    );
    return id;
  });
}

export function deleteProduct(actor: Actor, productId: string): "deleted" | "archived" {
  const db = getDb();
  return db.transaction((tx) => {
    const p = tx.select().from(schema.products).where(eq(schema.products.id, productId)).get();
    if (!p) throw new AdminError("Product not found.");
    const sold = tx.select({ id: schema.orderItems.id }).from(schema.orderItems).where(eq(schema.orderItems.productId, productId)).get();
    if (sold) {
      tx.update(schema.products).set({ status: "archived", updatedAt: new Date() }).where(eq(schema.products.id, productId)).run();
      writeAudit({ actor, action: "product.archive", entityType: "product", entityId: productId, before: { status: p.status }, after: { status: "archived" }, reason: "Has order history; archived instead of deleted" }, tx);
      return "archived";
    }
    tx.delete(schema.products).where(eq(schema.products.id, productId)).run();
    writeAudit({ actor, action: "product.delete", entityType: "product", entityId: productId, before: { name: p.name, slug: p.slug }, after: null }, tx);
    return "deleted";
  });
}

export function setProductStatus(actor: Actor, productId: string, status: schema.ProductStatus): void {
  const db = getDb();
  db.transaction((tx) => {
    const p = tx.select().from(schema.products).where(eq(schema.products.id, productId)).get();
    if (!p) throw new AdminError("Product not found.");
    tx.update(schema.products).set({ status, updatedAt: new Date() }).where(eq(schema.products.id, productId)).run();
    writeAudit({ actor, action: "product.status", entityType: "product", entityId: productId, before: { status: p.status }, after: { status } }, tx);
  });
}

export function bulkProducts(actor: Actor, ids: string[], action: "activate" | "draft" | "archive" | "adjust_price" | "set_stock", value?: number): number {
  const db = getDb();
  return db.transaction((tx) => {
    const rows = tx.select().from(schema.products).where(inArray(schema.products.id, ids)).all();
    for (const p of rows) {
      if (action === "activate" || action === "draft" || action === "archive") {
        const status = action === "activate" ? "active" : action === "draft" ? "draft" : "archived";
        tx.update(schema.products).set({ status, updatedAt: new Date() }).where(eq(schema.products.id, p.id)).run();
        writeAudit({ actor, action: "product.bulk_status", entityType: "product", entityId: p.id, before: { status: p.status }, after: { status } }, tx);
      } else if (action === "adjust_price") {
        if (value === undefined || value < -90 || value > 100) throw new AdminError("Price adjustment must be between -90% and +100%.");
        const basePrice = Math.max(100, Math.round(p.basePrice * (1 + value / 100)));
        tx.update(schema.products).set({ basePrice, updatedAt: new Date() }).where(eq(schema.products.id, p.id)).run();
        writeAudit({ actor, action: "product.bulk_price", entityType: "product", entityId: p.id, before: { basePrice: p.basePrice }, after: { basePrice }, reason: `${value > 0 ? "+" : ""}${value}%` }, tx);
      } else {
        if (value === undefined || value < 0 || !Number.isInteger(value)) throw new AdminError("Stock must be a whole number ≥ 0.");
        const before = tx.select().from(schema.productVariants).where(eq(schema.productVariants.productId, p.id)).all();
        tx.update(schema.productVariants).set({ stock: value }).where(eq(schema.productVariants.productId, p.id)).run();
        writeAudit({ actor, action: "variant.bulk_stock", entityType: "product", entityId: p.id, before: Object.fromEntries(before.map((v) => [v.sku, v.stock])), after: Object.fromEntries(before.map((v) => [v.sku, value])) }, tx);
      }
    }
    return rows.length;
  });
}

export function applyCsvRows(actor: Actor, rows: { sku: string; price?: number | ""; stock?: number | ""; status?: string }[]): { updated: number; errors: string[] } {
  const db = getDb();
  const errors: string[] = [];
  let updated = 0;
  db.transaction((tx) => {
    for (const [i, row] of rows.entries()) {
      const v = tx.select().from(schema.productVariants).where(eq(schema.productVariants.sku, row.sku)).get();
      if (!v) {
        errors.push(`Row ${i + 2}: unknown SKU ${row.sku}`);
        continue;
      }
      const p = tx.select().from(schema.products).where(eq(schema.products.id, v.productId)).get()!;
      const variantPatch: Partial<schema.ProductVariant> = {};
      if (typeof row.stock === "number") variantPatch.stock = row.stock;
      if (typeof row.price === "number") {
        const cents = Math.round(row.price * 100);
        variantPatch.priceOverride = cents === p.basePrice ? null : cents;
      }
      if (Object.keys(variantPatch).length) {
        tx.update(schema.productVariants).set({ ...variantPatch, version: v.version + 1 }).where(eq(schema.productVariants.id, v.id)).run();
        writeAudit({ actor, action: "variant.csv_import", entityType: "variant", entityId: v.sku, before: { stock: v.stock, priceOverride: v.priceOverride }, after: { stock: variantPatch.stock ?? v.stock, priceOverride: variantPatch.priceOverride === undefined ? v.priceOverride : variantPatch.priceOverride } }, tx);
      }
      if (row.status && row.status !== p.status && (row.status === "active" || row.status === "draft" || row.status === "archived")) {
        tx.update(schema.products).set({ status: row.status, updatedAt: new Date() }).where(eq(schema.products.id, p.id)).run();
        writeAudit({ actor, action: "product.csv_import", entityType: "product", entityId: p.id, before: { status: p.status }, after: { status: row.status } }, tx);
      }
      updated++;
    }
  });
  return { updated, errors };
}

export function listAdminOrders(filters: { q?: string; status?: string } = {}) {
  const db = getDb();
  const rows = db
    .select({
      order: schema.orders,
      customer: schema.users.name,
      items: sql<number>`(select coalesce(sum(oi.quantity), 0) from order_items oi where oi.order_id = "orders"."id")`,
    })
    .from(schema.orders)
    .leftJoin(schema.users, eq(schema.users.id, schema.orders.userId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(500)
    .all();
  const q = filters.q?.trim().toLowerCase() ?? "";
  return rows
    .filter((r) => !filters.status || (filters.status === "returns" ? r.order.returnStatus === "requested" : r.order.status === filters.status))
    .filter((r) => !q || r.order.number.toLowerCase().includes(q) || r.order.email.toLowerCase().includes(q) || (r.customer ?? "").toLowerCase().includes(q));
}

export function listCustomers(q = "", userId?: string) {
  const db = getDb();
  const rows = db
    .select({
      user: schema.users,
      orders: sql<number>`(select count(*) from orders o where o.user_id = "users"."id" and o.status not in ('cancelled'))`,
      spend: sql<number>`(select coalesce(sum(o.total - o.refunded_amount), 0) from orders o where o.user_id = "users"."id" and o.status in ('paid','packed','shipped','delivered','refunded'))`,
      paidOrders: sql<number>`(select count(*) from orders o where o.user_id = "users"."id" and o.status in ('paid','packed','shipped','delivered','refunded'))`,
      lastOrder: sql<number | null>`(select max(o.created_at) from orders o where o.user_id = "users"."id")`,
    })
    .from(schema.users)
    .where(and(eq(schema.users.role, "customer"), userId ? eq(schema.users.id, userId) : undefined))
    .orderBy(desc(schema.users.createdAt))
    .all();
  const needle = q.trim().toLowerCase();
  return rows
    .filter((r) => !needle || r.user.email.includes(needle) || r.user.name.toLowerCase().includes(needle))
    .map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      phone: r.user.phone,
      status: r.user.status,
      notes: r.user.notes,
      createdAt: r.user.createdAt,
      orders: r.orders,
      paidOrders: r.paidOrders,
      ltv: r.spend,
      aov: r.paidOrders ? Math.round(r.spend / r.paidOrders) : 0,
      lastOrder: r.lastOrder ? new Date(r.lastOrder) : null,
    }));
}

export type AdminCustomer = ReturnType<typeof listCustomers>[number];

/** Everything the CRM profile shows: stats, addresses, order history, buying habits and staff changes. */
export function getAdminCustomer(id: string) {
  const db = getDb();
  const customer = listCustomers("", id)[0];
  if (!customer) return null;
  const ownerKey = `u:${id}`;
  const addresses = db.select().from(schema.addresses).where(eq(schema.addresses.userId, id)).orderBy(desc(schema.addresses.isDefault)).all();
  const orders = listCustomerOrders(id, 25);
  const categories = db
    .select({ category: schema.products.category, units: sql<number>`sum(${schema.orderItems.quantity})`, spend: sql<number>`sum(${schema.orderItems.lineTotal})` })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .innerJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
    .where(and(eq(schema.orders.userId, id), inArray(schema.orders.status, ["paid", "packed", "shipped", "delivered"])))
    .groupBy(schema.products.category)
    .orderBy(desc(sql`sum(${schema.orderItems.lineTotal})`))
    .all();
  const cart = db
    .select({ units: sql<number>`coalesce(sum(${schema.cartItems.quantity}), 0)`, value: sql<number>`coalesce(sum(${schema.cartItems.quantity} * coalesce(${schema.productVariants.priceOverride}, ${schema.products.basePrice})), 0)`, updatedAt: sql<number | null>`max(${schema.cartItems.updatedAt})` })
    .from(schema.cartItems)
    .innerJoin(schema.productVariants, eq(schema.productVariants.id, schema.cartItems.variantId))
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(eq(schema.cartItems.ownerKey, ownerKey))
    .get();
  const wishlist = db.select({ n: sql<number>`count(*)` }).from(schema.wishlistItems).where(eq(schema.wishlistItems.ownerKey, ownerKey)).get()?.n ?? 0;
  const reviews = db.select({ n: sql<number>`count(*)`, avg: sql<number | null>`round(avg(${schema.reviews.rating}), 1)` }).from(schema.reviews).where(eq(schema.reviews.userId, id)).get();
  const refunds = orders.filter((o) => o.status === "refunded").length;
  return {
    customer,
    addresses,
    orders,
    categories,
    cart: { units: cart?.units ?? 0, value: cart?.value ?? 0, updatedAt: cart?.updatedAt ?? null },
    wishlist,
    reviews: { count: reviews?.n ?? 0, average: reviews?.avg ?? null },
    refunds,
    audit: listAudit({ entity: "user", entityId: customer.email, limit: 20 }),
  };
}

export function updateCustomer(actor: Actor, userId: string, patch: { status?: "active" | "suspended"; notes?: string }): boolean {
  const db = getDb();
  return db.transaction((tx) => {
    const u = tx.select().from(schema.users).where(and(eq(schema.users.id, userId), eq(schema.users.role, "customer"))).get();
    if (!u) throw new AdminError("Customer not found.");
    const set: Partial<schema.User> = { updatedAt: new Date() };
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.notes !== undefined) set.notes = patch.notes;
    tx.update(schema.users).set(set).where(eq(schema.users.id, userId)).run();
    writeAudit(
      { actor, action: "customer.update", entityType: "user", entityId: u.email, before: { status: u.status, notes: u.notes }, after: { status: set.status ?? u.status, notes: set.notes ?? u.notes } },
      tx,
    );
    return patch.status === "suspended" && u.status !== "suspended";
  });
}

export function listPromos() {
  const db = getDb();
  return db
    .select({
      promo: schema.promoCodes,
      // Paid orders only, net of refunds. An order can carry two codes, so its revenue is attributed to both.
      orders: sql<number>`(select count(distinct r.order_id) from promo_redemptions r join orders o on o.id = r.order_id where r.promo_id = "promo_codes"."id" and o.status in ('paid','packed','shipped','delivered','refunded'))`,
      revenue: sql<number>`(select coalesce(sum(o.total - o.refunded_amount), 0) from promo_redemptions r join orders o on o.id = r.order_id where r.promo_id = "promo_codes"."id" and o.status in ('paid','packed','shipped','delivered','refunded'))`,
      discount: sql<number>`(select coalesce(sum(r.amount), 0) from promo_redemptions r join orders o on o.id = r.order_id where r.promo_id = "promo_codes"."id" and o.status in ('paid','packed','shipped','delivered','refunded'))`,
    })
    .from(schema.promoCodes)
    .orderBy(desc(schema.promoCodes.createdAt))
    .all();
}

/** Distinct paid orders that used at least one code, so two-code orders aren't counted twice. */
export function promoTotals() {
  const db = getDb();
  const paid = ["paid", "packed", "shipped", "delivered", "refunded"] as const;
  const withCode = db
    .select({ orders: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(${schema.orders.total} - ${schema.orders.refundedAmount}), 0)` })
    .from(schema.orders)
    .where(and(inArray(schema.orders.status, paid), sql`exists (select 1 from promo_redemptions r where r.order_id = "orders"."id")`))
    .get();
  const discount = db
    .select({ n: sql<number>`coalesce(sum(${schema.promoRedemptions.amount}), 0)` })
    .from(schema.promoRedemptions)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.promoRedemptions.orderId))
    .where(inArray(schema.orders.status, paid))
    .get();
  const allPaid = db.select({ n: sql<number>`count(*)` }).from(schema.orders).where(inArray(schema.orders.status, paid)).get();
  return { orders: withCode?.orders ?? 0, revenue: withCode?.revenue ?? 0, discount: discount?.n ?? 0, paidOrders: allPaid?.n ?? 0 };
}

export function setPromoActive(actor: Actor, id: string, active: boolean): string {
  return getDb().transaction((tx) => {
    const before = tx.select().from(schema.promoCodes).where(eq(schema.promoCodes.id, id)).get();
    if (!before) throw new AdminError("Promotion not found.");
    if (before.active !== active) {
      tx.update(schema.promoCodes).set({ active }).where(eq(schema.promoCodes.id, id)).run();
      writeAudit({ actor, action: active ? "promo.resume" : "promo.pause", entityType: "promo", entityId: before.code, before: { active: before.active }, after: { active } }, tx);
    }
    return before.code;
  });
}

export function upsertPromo(
  actor: Actor,
  data: {
    id?: string;
    code: string;
    description: string;
    type: schema.PromoType;
    value: number;
    minSubtotal: number;
    startsAt: Date | null;
    endsAt: Date | null;
    usageLimit: number | null;
    perUserLimit: number | null;
    stackable: boolean;
    active: boolean;
  },
): void {
  const db = getDb();
  db.transaction((tx) => {
    const clash = tx.select({ id: schema.promoCodes.id }).from(schema.promoCodes).where(and(eq(schema.promoCodes.code, data.code), data.id ? ne(schema.promoCodes.id, data.id) : undefined)).get();
    if (clash) throw new AdminError("That code already exists.", "code");
    const { id, ...values } = data;
    if (id) {
      const before = tx.select().from(schema.promoCodes).where(eq(schema.promoCodes.id, id)).get();
      if (!before) throw new AdminError("Promotion not found.");
      tx.update(schema.promoCodes).set(values).where(eq(schema.promoCodes.id, id)).run();
      writeAudit({ actor, action: "promo.update", entityType: "promo", entityId: data.code, before: { ...before, createdAt: undefined }, after: { ...before, ...values, createdAt: undefined } }, tx);
    } else {
      tx.insert(schema.promoCodes).values({ id: randomUUID(), ...values }).run();
      writeAudit({ actor, action: "promo.create", entityType: "promo", entityId: data.code, before: null, after: values }, tx);
    }
  });
}

export const AUDIT_ENTITIES = ["product", "variant", "order", "user", "promo", "media"] as const;

export function auditEntityCounts(): Record<string, number> {
  const rows = getDb().select({ entity: schema.auditLogs.entityType, n: sql<number>`count(*)` }).from(schema.auditLogs).groupBy(schema.auditLogs.entityType).all();
  return Object.fromEntries(rows.map((r) => [r.entity, r.n]));
}

/** Keyset cursor: entries strictly older than (at, rowid), so equal timestamps never skip or repeat. */
export type AuditCursor = { at: number; rowid: number };

export function listAudit(opts: { limit?: number; entity?: string; entityId?: string; q?: string; cursor?: AuditCursor } = {}) {
  const db = getDb();
  const needle = opts.q?.trim().replace(/[%_\\]/g, "");
  const c = opts.cursor;
  return db
    .select({ ...getTableColumns(schema.auditLogs), rowid: sql<number>`rowid` })
    .from(schema.auditLogs)
    .where(
      and(
        opts.entity ? eq(schema.auditLogs.entityType, opts.entity) : undefined,
        opts.entityId ? eq(schema.auditLogs.entityId, opts.entityId) : undefined,
        c ? sql`(${schema.auditLogs.createdAt} < ${c.at} or (${schema.auditLogs.createdAt} = ${c.at} and rowid < ${c.rowid}))` : undefined,
        needle
          ? sql`(${schema.auditLogs.action} like ${`%${needle}%`} or ${schema.auditLogs.entityId} like ${`%${needle}%`} or ${schema.auditLogs.actorEmail} like ${`%${needle}%`})`
          : undefined,
      ),
    )
    .orderBy(desc(schema.auditLogs.createdAt), sql`rowid desc`)
    .limit(Math.min(opts.limit ?? 100, 500))
    .all();
}

export function getAdminProduct(id: string) {
  const db = getDb();
  const product = db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  if (!product) return null;
  const variants = db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, id)).all();
  const sales = db
    .select({ units: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)`, revenue: sql<number>`coalesce(sum(${schema.orderItems.lineTotal}), 0)` })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(and(eq(schema.orderItems.productId, id), notInArray(schema.orders.status, ["cancelled", "refunded"])))
    .get() ?? { units: 0, revenue: 0 };
  return { product, variants, sales, history: listAudit({ entity: "product", entityId: id, limit: 8 }) };
}

/** Admin order view: the order plus who placed it, their value to the store and who touched it. */
export function getAdminOrder(id: string) {
  const db = getDb();
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
  if (!order) return null;
  const items = db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id)).all();
  const events = db
    .select({ event: schema.orderEvents, actor: schema.users.name, actorRole: schema.users.role })
    .from(schema.orderEvents)
    .leftJoin(schema.users, eq(schema.users.id, schema.orderEvents.actorId))
    .where(eq(schema.orderEvents.orderId, id))
    .orderBy(schema.orderEvents.createdAt, sql`"order_events".rowid`)
    .all();
  const customer = order.userId ? (listCustomers("", order.userId)[0] ?? null) : null;
  return { order, items, events, customer, audit: listAudit({ entity: "order", entityId: order.number, limit: 12 }) };
}

export function listCustomerOrders(userId: string, limit = 5) {
  return getDb()
    .select({
      id: schema.orders.id,
      number: schema.orders.number,
      status: schema.orders.status,
      total: schema.orders.total,
      refunded: schema.orders.refundedAmount,
      returnStatus: schema.orders.returnStatus,
      createdAt: schema.orders.createdAt,
      items: sql<number>`(select coalesce(sum(oi.quantity), 0) from order_items oi where oi.order_id = "orders"."id")`,
    })
    .from(schema.orders)
    .where(eq(schema.orders.userId, userId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit)
    .all();
}

export function adminCommandIndex(q: string) {
  const db = getDb();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const orders = db
    .select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status })
    .from(schema.orders)
    .where(sql`${schema.orders.number} like ${like}`)
    .limit(5)
    .all();
  const skus = db
    .select({ sku: schema.productVariants.sku, productId: schema.productVariants.productId, name: schema.products.name })
    .from(schema.productVariants)
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(sql`${schema.productVariants.sku} like ${like} or ${schema.products.name} like ${like}`)
    .limit(6)
    .all();
  return { orders, skus };
}
