import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { canTransition, CUSTOMER_CANCELLABLE, RETURN_WINDOW_DAYS, restocksOn, type OrderStatusValue } from "@/lib/order-state";
import { deliveryWindow } from "@/lib/pricing";
import type { CheckoutData } from "@/lib/validations/commerce";
import { getDb, schema, type DB } from "../db";
import { orderNumber } from "../db/seed";
import type { SessionUser } from "../auth/session";
import { writeAudit } from "./audit";
import { buildCartView } from "./cart";
import { resolvePromos } from "./promo";

export class OrderError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

function restock(tx: Tx, orderId: string) {
  const items = tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId)).all();
  for (const item of items) {
    if (!item.variantId) continue;
    tx.update(schema.productVariants)
      .set({ stock: sql`${schema.productVariants.stock} + ${item.quantity}`, version: sql`${schema.productVariants.version} + 1` })
      .where(eq(schema.productVariants.id, item.variantId))
      .run();
    if (item.productId) {
      tx.update(schema.products)
        .set({ soldCount: sql`max(0, ${schema.products.soldCount} - ${item.quantity})` })
        .where(eq(schema.products.id, item.productId))
        .run();
    }
  }
}

/** Simulated PSP. Test card 4000 0000 0000 0002 always declines. */
function authorizePayment(payment: CheckoutData["payment"]): { ok: true; last4: string | null } | { ok: false; reason: string } {
  if (payment.method === "card") {
    if (payment.cardNumber === "4000000000000002") return { ok: false, reason: "Your card was declined. Try 4242 4242 4242 4242." };
    return { ok: true, last4: payment.cardNumber.slice(-4) };
  }
  if (payment.method === "gcash") return { ok: true, last4: payment.gcashNumber.slice(-4) };
  return { ok: true, last4: null };
}

/**
 * Server-authoritative checkout. Prices, discounts, shipping and VAT are recomputed from the DB.
 * Idempotent per (user, idempotencyKey). Stock is decremented with a conditional UPDATE inside a
 * write transaction so the last unit can never be sold twice.
 */
export function placeOrder(user: SessionUser, ownerKey: string, data: CheckoutData): { orderId: string; number: string; replayed: boolean } {
  const db = getDb();
  const prior = db
    .select({ id: schema.orders.id, number: schema.orders.number })
    .from(schema.orders)
    .where(and(eq(schema.orders.userId, user.id), eq(schema.orders.idempotencyKey, data.idempotencyKey)))
    .get();
  if (prior) return { orderId: prior.id, number: prior.number, replayed: true };

  const { promos, rejected } = resolvePromos(data.promoCodes, user.id);
  if (rejected.length) throw new OrderError(`${rejected[0]!.code}: ${rejected[0]!.reason}`, "promoCodes");

  const cart = buildCartView(ownerKey, { promos, shippingTier: data.shippingTier, giftWrap: data.giftWrap });
  const lines = cart.lines.filter((l) => l.quantity > 0);
  if (!lines.length) throw new OrderError("Your cart is empty.");
  if (cart.issues.length) throw new OrderError(cart.issues.join(" "));
  const notApplied = cart.totals.promos.find((p) => !p.applied);
  if (notApplied) throw new OrderError(`${notApplied.code}: ${notApplied.reason}`, "promoCodes");

  const payment = authorizePayment(data.payment);
  if (!payment.ok) throw new OrderError(payment.reason, "payment");

  const orderId = randomUUID();
  const number = orderNumber();
  const eta = deliveryWindow(data.shippingTier);
  const status: OrderStatusValue = data.payment.method === "cod" ? "pending" : "paid";

  db.transaction((tx) => {
    for (const line of lines) {
      const res = tx
        .update(schema.productVariants)
        .set({ stock: sql`${schema.productVariants.stock} - ${line.quantity}`, version: sql`${schema.productVariants.version} + 1` })
        .where(and(eq(schema.productVariants.id, line.variantId), sql`${schema.productVariants.stock} >= ${line.quantity}`))
        .run();
      if (res.changes !== 1) throw new OrderError(`${line.name} (${line.variantLabel}) sold out while you were checking out.`);
      tx.update(schema.products)
        .set({ soldCount: sql`${schema.products.soldCount} + ${line.quantity}` })
        .where(eq(schema.products.id, line.productId))
        .run();
    }

    const t = cart.totals;
    tx.insert(schema.orders)
      .values({
        id: orderId,
        number,
        userId: user.id,
        idempotencyKey: data.idempotencyKey,
        status,
        email: data.contact.email,
        shippingAddress: { ...data.shipping, line2: data.shipping.line2 || undefined },
        shippingTier: data.shippingTier,
        paymentMethod: data.payment.method,
        paymentLast4: payment.last4,
        subtotal: t.subtotal,
        tierDiscount: t.tierDiscount,
        bundleDiscount: t.bundleDiscount,
        promoDiscount: t.promoDiscount,
        shippingFee: t.shippingFee,
        giftWrapFee: t.giftWrapFee,
        taxIncluded: t.taxIncluded,
        total: t.total,
        promoCodes: t.promos.filter((p) => p.applied).map((p) => p.code),
        giftWrap: data.giftWrap,
        giftNote: data.giftNote || null,
        etaFrom: eta.from,
        etaTo: eta.to,
      })
      .run();

    for (const line of lines) {
      tx.insert(schema.orderItems)
        .values({
          id: randomUUID(),
          orderId,
          productId: line.productId,
          variantId: line.variantId,
          name: line.name,
          sku: "",
          variantLabel: line.variantLabel,
          image: line.image?.src ?? null,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
        })
        .run();
    }
    tx.run(
      sql`UPDATE order_items SET sku = (SELECT sku FROM product_variants WHERE product_variants.id = order_items.variant_id) WHERE order_id = ${orderId}`,
    );

    tx.insert(schema.orderEvents).values({ id: randomUUID(), orderId, status: "pending", note: "Order placed" }).run();
    if (status === "paid") {
      tx.insert(schema.orderEvents)
        .values({ id: randomUUID(), orderId, status: "paid", note: `Payment authorised (${data.payment.method.toUpperCase()}${payment.last4 ? ` ••${payment.last4}` : ""})` })
        .run();
    }

    for (const applied of t.promos.filter((p) => p.applied)) {
      const promo = tx.select().from(schema.promoCodes).where(eq(schema.promoCodes.code, applied.code)).get();
      if (!promo) continue;
      const res = tx
        .update(schema.promoCodes)
        .set({ usedCount: sql`${schema.promoCodes.usedCount} + 1` })
        .where(and(eq(schema.promoCodes.id, promo.id), sql`(${schema.promoCodes.usageLimit} IS NULL OR ${schema.promoCodes.usedCount} < ${schema.promoCodes.usageLimit})`))
        .run();
      if (res.changes !== 1) throw new OrderError(`${applied.code} was just fully redeemed.`, "promoCodes");
      tx.insert(schema.promoRedemptions).values({ id: randomUUID(), promoId: promo.id, userId: user.id, orderId, amount: applied.amount }).run();
    }

    if (data.saveAddress) {
      const same = tx
        .select({ id: schema.addresses.id })
        .from(schema.addresses)
        .where(and(eq(schema.addresses.userId, user.id), eq(schema.addresses.line1, data.shipping.line1), eq(schema.addresses.postalCode, data.shipping.postalCode)))
        .get();
      if (!same) {
        const hasAny = tx.select({ id: schema.addresses.id }).from(schema.addresses).where(eq(schema.addresses.userId, user.id)).get();
        tx.insert(schema.addresses).values({ id: randomUUID(), userId: user.id, label: hasAny ? "Saved" : "Home", isDefault: !hasAny, ...data.shipping }).run();
      }
    }

    tx.delete(schema.cartItems).where(eq(schema.cartItems.ownerKey, ownerKey)).run();
  });

  return { orderId, number, replayed: false };
}

export function listOrdersForUser(userId: string) {
  const db = getDb();
  const orders = db.select().from(schema.orders).where(eq(schema.orders.userId, userId)).orderBy(desc(schema.orders.createdAt)).all();
  const counts = db
    .select({ orderId: schema.orderItems.orderId, n: sql<number>`sum(${schema.orderItems.quantity})`, image: sql<string | null>`min(${schema.orderItems.image})` })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(eq(schema.orders.userId, userId))
    .groupBy(schema.orderItems.orderId)
    .all();
  const map = new Map(counts.map((c) => [c.orderId, c]));
  return orders.map((o) => ({ ...o, itemCount: map.get(o.id)?.n ?? 0, thumb: map.get(o.id)?.image ?? null }));
}

/** Object-level authorisation: customers only ever receive their own orders (404, not 403, to avoid enumeration). */
export function getOrderForViewer(orderId: string, viewer: SessionUser) {
  const db = getDb();
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!order) return null;
  if (viewer.role !== "admin" && order.userId !== viewer.id) return null;
  const items = db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId)).all();
  const events = db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, orderId)).orderBy(schema.orderEvents.createdAt).all();
  return { order, items, events };
}

export function cancelOrderAsCustomer(user: SessionUser, orderId: string, reason: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const order = tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
    if (!order || order.userId !== user.id) throw new OrderError("Order not found.");
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) throw new OrderError("This order has already shipped. Request a return instead.");
    restock(tx, orderId);
    tx.update(schema.orders)
      .set({ status: "cancelled", refundedAmount: order.status === "pending" ? 0 : order.total, updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
      .run();
    tx.insert(schema.orderEvents)
      .values({ id: randomUUID(), orderId, status: "cancelled", note: `Cancelled by customer: ${reason}`, actorId: user.id })
      .run();
    writeAudit({ actor: user, action: "order.cancel", entityType: "order", entityId: order.number, before: { status: order.status }, after: { status: "cancelled" }, reason }, tx);
  });
}

export function requestReturn(user: SessionUser, orderId: string, reason: string): void {
  const db = getDb();
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!order || order.userId !== user.id) throw new OrderError("Order not found.");
  if (order.status !== "delivered") throw new OrderError("Returns open once your order is delivered.");
  if (order.returnStatus !== "none") throw new OrderError("A return was already requested for this order.");
  const deliveredAt = order.updatedAt.getTime();
  if (Date.now() - deliveredAt > RETURN_WINDOW_DAYS * 86_400_000) throw new OrderError(`Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery.`);
  db.transaction((tx) => {
    tx.update(schema.orders).set({ returnStatus: "requested", returnReason: reason, updatedAt: order.updatedAt }).where(eq(schema.orders.id, orderId)).run();
    tx.insert(schema.orderEvents).values({ id: randomUUID(), orderId, status: "return_requested", note: reason, actorId: user.id }).run();
  });
}

export function transitionOrder(
  actor: { id: string; email: string },
  input: { orderId: string; to: OrderStatusValue; note: string; carrier: string; trackingNumber: string; refundAmount?: number },
): void {
  const db = getDb();
  db.transaction((tx) => {
    const order = tx.select().from(schema.orders).where(eq(schema.orders.id, input.orderId)).get();
    if (!order) throw new OrderError("Order not found.");
    if (!canTransition(order.status, input.to)) throw new OrderError(`Cannot move an order from ${order.status} to ${input.to}.`, "to");

    const patch: Partial<schema.Order> = { status: input.to, updatedAt: new Date() };
    if (input.to === "shipped") {
      patch.carrier = input.carrier;
      patch.trackingNumber = input.trackingNumber.toUpperCase();
    }
    if (input.to === "refunded") {
      const remaining = order.total - order.refundedAmount;
      const amount = input.refundAmount !== undefined ? Math.round(input.refundAmount * 100) : remaining;
      if (amount <= 0 || amount > remaining) throw new OrderError(`Refund must be between ₱0.01 and the remaining ₱${(remaining / 100).toFixed(2)}.`, "refundAmount");
      patch.refundedAmount = order.refundedAmount + amount;
      if (patch.refundedAmount < order.total) patch.status = order.status;
      if (order.returnStatus === "requested") patch.returnStatus = "approved";
    }
    if (input.to === "cancelled" && order.status !== "pending") patch.refundedAmount = order.total;
    if (restocksOn(order.status, input.to) && patch.status === input.to) restock(tx, order.id);

    tx.update(schema.orders).set(patch).where(eq(schema.orders.id, order.id)).run();
    const partial = input.to === "refunded" && patch.status !== "refunded";
    tx.insert(schema.orderEvents)
      .values({
        id: randomUUID(),
        orderId: order.id,
        status: partial ? "partial_refund" : input.to,
        note:
          input.to === "shipped"
            ? `Handed to ${input.carrier} · ${patch.trackingNumber}`
            : input.to === "refunded"
              ? `${partial ? "Partial refund" : "Refunded"} ₱${((patch.refundedAmount! - order.refundedAmount) / 100).toFixed(2)}${input.note ? ` — ${input.note}` : ""}`
              : input.note || null,
        actorId: actor.id,
      })
      .run();
    writeAudit(
      {
        actor,
        action: partial ? "order.partial_refund" : `order.${input.to}`,
        entityType: "order",
        entityId: order.number,
        before: { status: order.status, refundedAmount: order.refundedAmount, trackingNumber: order.trackingNumber },
        after: { status: patch.status, refundedAmount: patch.refundedAmount ?? order.refundedAmount, trackingNumber: patch.trackingNumber ?? order.trackingNumber },
        reason: input.note || null,
      },
      tx,
    );
  });
}

export function hasPurchased(userId: string, productId: string): boolean {
  const row = getDb()
    .select({ id: schema.orderItems.id })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(and(eq(schema.orders.userId, userId), eq(schema.orderItems.productId, productId), eq(schema.orders.status, "delivered")))
    .get();
  return !!row;
}
