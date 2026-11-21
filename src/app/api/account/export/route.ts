import { eq, inArray } from "drizzle-orm";
import { requireUser } from "@/server/auth/guards";
import { getDb, schema } from "@/server/db";
import { handler } from "@/server/security/route";

/** GDPR Art. 15/20: machine-readable export of everything we hold about the signed-in customer. */
export const GET = handler("account.export", async () => {
  const user = await requireUser();
  const db = getDb();
  const orders = db.select().from(schema.orders).where(eq(schema.orders.userId, user.id)).all();
  const orderIds = orders.map((o) => o.id);
  const payload = {
    exportedAt: new Date().toISOString(),
    profile: { name: user.name, email: user.email, phone: user.phone, createdAt: user.createdAt },
    addresses: db.select().from(schema.addresses).where(eq(schema.addresses.userId, user.id)).all().map(({ userId: _u, ...a }) => a),
    orders: orders.map(({ idempotencyKey: _k, userId: _u, ...o }) => o),
    orderItems: orderIds.length ? db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orderIds)).all() : [],
    reviews: db.select().from(schema.reviews).where(eq(schema.reviews.userId, user.id)).all(),
    wishlist: db.select().from(schema.wishlistItems).where(eq(schema.wishlistItems.ownerKey, `u:${user.id}`)).all(),
    restockAlerts: db.select().from(schema.restockAlerts).where(eq(schema.restockAlerts.userId, user.id)).all(),
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="emporium-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
