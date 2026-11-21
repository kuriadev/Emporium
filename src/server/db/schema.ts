import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);

export const USER_ROLES = ["customer", "admin"] as const;
export const ADMIN_ROLES = ["super_admin", "catalog_manager", "fulfillment_support"] as const;
export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;
export const CATEGORIES = ["gadgets", "furniture", "accessories", "clothes"] as const;
export const ORDER_STATUSES = ["pending", "paid", "packed", "shipped", "delivered", "cancelled", "refunded"] as const;
export const RETURN_STATUSES = ["none", "requested", "approved", "rejected"] as const;
export const PROMO_TYPES = ["percent", "fixed", "free_shipping"] as const;
export const PAYMENT_METHODS = ["card", "gcash", "cod"] as const;
export const SHIPPING_TIERS = ["standard", "express"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type AdminRole = (typeof ADMIN_ROLES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type Category = (typeof CATEGORIES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ReturnStatus = (typeof RETURN_STATUSES)[number];
export type PromoType = (typeof PROMO_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type ShippingTier = (typeof SHIPPING_TIERS)[number];

export interface ProductImage {
  src: string;
  alt: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull().default("customer"),
    adminRole: text("admin_role", { enum: ADMIN_ROLES }),
    status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
    sessionVersion: integer("session_version").notNull().default(1),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionVersion: integer("session_version").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const addresses = sqliteTable(
  "addresses",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    province: text("province").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull().default("PH"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const products = sqliteTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    brand: text("brand").notNull(),
    category: text("category", { enum: CATEGORIES }).notNull(),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    basePrice: integer("base_price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    status: text("status", { enum: PRODUCT_STATUSES }).notNull().default("draft"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    tierPricing: integer("tier_pricing", { mode: "boolean" }).notNull().default(false),
    images: text("images", { mode: "json" }).$type<ProductImage[]>().notNull().default(sql`'[]'`),
    specs: text("specs", { mode: "json" }).$type<Record<string, string>>().notNull().default(sql`'{}'`),
    materials: text("materials").notNull().default(""),
    dimensions: text("dimensions").notNull().default(""),
    weightGrams: integer("weight_grams").notNull().default(0),
    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("products_slug_idx").on(t.slug), index("products_category_idx").on(t.category)],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: id(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    color: text("color"),
    colorHex: text("color_hex"),
    size: text("size"),
    material: text("material"),
    priceOverride: integer("price_override"),
    stock: integer("stock").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(5),
    version: integer("version").notNull().default(1),
  },
  (t) => [uniqueIndex("variants_sku_idx").on(t.sku), index("variants_product_idx").on(t.productId)],
);

export const cartItems = sqliteTable(
  "cart_items",
  {
    id: id(),
    ownerKey: text("owner_key").notNull(),
    variantId: text("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("cart_owner_variant_idx").on(t.ownerKey, t.variantId)],
);

export const wishlistItems = sqliteTable(
  "wishlist_items",
  {
    id: id(),
    ownerKey: text("owner_key").notNull(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wishlist_owner_product_idx").on(t.ownerKey, t.productId)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: id(),
    number: text("number").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    returnStatus: text("return_status", { enum: RETURN_STATUSES }).notNull().default("none"),
    returnReason: text("return_reason"),
    email: text("email").notNull(),
    shippingAddress: text("shipping_address", { mode: "json" }).$type<ShippingAddress>().notNull(),
    shippingTier: text("shipping_tier", { enum: SHIPPING_TIERS }).notNull().default("standard"),
    paymentMethod: text("payment_method", { enum: PAYMENT_METHODS }).notNull(),
    paymentLast4: text("payment_last4"),
    subtotal: integer("subtotal").notNull(),
    tierDiscount: integer("tier_discount").notNull().default(0),
    bundleDiscount: integer("bundle_discount").notNull().default(0),
    promoDiscount: integer("promo_discount").notNull().default(0),
    shippingFee: integer("shipping_fee").notNull(),
    giftWrapFee: integer("gift_wrap_fee").notNull().default(0),
    taxIncluded: integer("tax_included").notNull(),
    total: integer("total").notNull(),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    promoCodes: text("promo_codes", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    giftWrap: integer("gift_wrap", { mode: "boolean" }).notNull().default(false),
    giftNote: text("gift_note"),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    etaFrom: integer("eta_from", { mode: "timestamp_ms" }),
    etaTo: integer("eta_to", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    uniqueIndex("orders_idempotency_idx").on(t.userId, t.idempotencyKey),
    index("orders_user_idx").on(t.userId),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: text("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    variantLabel: text("variant_label").notNull(),
    image: text("image"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: id(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    actorId: text("actor_id"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const promoCodes = sqliteTable(
  "promo_codes",
  {
    id: id(),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    type: text("type", { enum: PROMO_TYPES }).notNull(),
    value: integer("value").notNull().default(0),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    usageLimit: integer("usage_limit"),
    perUserLimit: integer("per_user_limit"),
    usedCount: integer("used_count").notNull().default(0),
    stackable: integer("stackable", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("promo_code_idx").on(t.code)],
);

export const promoRedemptions = sqliteTable(
  "promo_redemptions",
  {
    id: id(),
    promoId: text("promo_id").notNull().references(() => promoCodes.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("redemptions_promo_idx").on(t.promoId)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: id(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("reviews_product_idx").on(t.productId), uniqueIndex("reviews_user_product_idx").on(t.productId, t.userId)],
);

export const restockAlerts = sqliteTable(
  "restock_alerts",
  {
    id: id(),
    variantId: text("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    userId: text("user_id"),
    notifiedAt: integer("notified_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("restock_variant_email_idx").on(t.variantId, t.email)],
);

export const searchQueries = sqliteTable(
  "search_queries",
  {
    id: id(),
    query: text("query").notNull(),
    resultCount: integer("result_count").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("search_query_idx").on(t.query)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id"),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: text("before", { mode: "json" }).$type<Record<string, unknown> | null>(),
    after: text("after", { mode: "json" }).$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_created_idx").on(t.createdAt)],
);

export const supportMessages = sqliteTable("support_messages", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Address = typeof addresses.$inferSelect;
