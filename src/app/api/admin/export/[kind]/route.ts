import { desc, eq, sql } from "drizzle-orm";
import { toCsv } from "@/lib/security/csv";
import { requireAdmin } from "@/server/auth/guards";
import { getDb, schema } from "@/server/db";
import { handler, jsonError } from "@/server/security/route";

export const GET = handler<{ params: Promise<{ kind: string }> }>("admin.export", async (_req, { params }) => {
  const { kind } = await params;
  const db = getDb();
  let csv: string;

  if (kind === "products") {
    await requireAdmin("catalog:write");
    const rows = db
      .select({ v: schema.productVariants, p: schema.products })
      .from(schema.productVariants)
      .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
      .orderBy(schema.products.name)
      .all();
    csv = toCsv(
      ["sku", "product", "slug", "category", "status", "color", "size", "material", "price", "stock", "reorder_threshold"],
      rows.map(({ v, p }) => [v.sku, p.name, p.slug, p.category, p.status, v.color, v.size, v.material, ((v.priceOverride ?? p.basePrice) / 100).toFixed(2), v.stock, v.reorderThreshold]),
    );
  } else if (kind === "orders") {
    await requireAdmin("orders:view");
    const rows = db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).all();
    csv = toCsv(
      ["number", "created_at", "status", "return_status", "email", "city", "payment", "subtotal", "discounts", "shipping", "vat_included", "total", "refunded", "promo_codes", "tracking"],
      rows.map((o) => [
        o.number,
        o.createdAt.toISOString(),
        o.status,
        o.returnStatus,
        o.email,
        o.shippingAddress.city,
        o.paymentMethod,
        (o.subtotal / 100).toFixed(2),
        ((o.tierDiscount + o.bundleDiscount + o.promoDiscount) / 100).toFixed(2),
        (o.shippingFee / 100).toFixed(2),
        (o.taxIncluded / 100).toFixed(2),
        (o.total / 100).toFixed(2),
        (o.refundedAmount / 100).toFixed(2),
        o.promoCodes.join(" "),
        o.trackingNumber,
      ]),
    );
  } else if (kind === "audit") {
    await requireAdmin("audit:view");
    const rows = db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt), sql`rowid desc`).limit(10_000).all();
    csv = toCsv(
      ["created_at", "actor_email", "action", "entity_type", "entity_id", "reason", "before", "after"],
      rows.map((e) => [e.createdAt.toISOString(), e.actorEmail, e.action, e.entityType, e.entityId, e.reason, e.before ? JSON.stringify(e.before) : "", e.after ? JSON.stringify(e.after) : ""]),
    );
  } else {
    return jsonError(404, "Unknown export");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="emporium-${kind}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
