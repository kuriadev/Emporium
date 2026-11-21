import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { computeTotals, deliveryWindow } from "../../lib/pricing";
import { hashPasswordSync } from "../auth/password";
import { BUNDLES, SEED_PRODUCTS } from "./catalog-data";
import * as s from "./schema";

type Db = BetterSQLite3Database<typeof s>;

export const DEMO_ACCOUNTS = {
  customer: { email: "alex.rivera@example.com", password: "Customer#2026", name: "Alex Rivera" },
  customer2: { email: "maria.santos@example.com", password: "Customer#2026", name: "Maria Santos" },
  superAdmin: { email: "admin@emporium.test", password: "Admin#Emporium2026", name: "Bea Villanueva" },
  catalogManager: { email: "catalog@emporium.test", password: "Catalog#Emporium2026", name: "Paolo Reyes" },
  fulfillment: { email: "support@emporium.test", password: "Support#Emporium2026", name: "Jamie Cruz" },
} as const;

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

export function orderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return "EM-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function seedDatabase(db: Db): void {
  const existing = db.select({ n: count() }).from(s.users).get();
  if (existing && existing.n > 0) return;

  db.transaction((tx) => {
    const hash = new Map<string, string>();
    const pw = (p: string) => {
      if (!hash.has(p)) hash.set(p, hashPasswordSync(p));
      return hash.get(p)!;
    };

    const alex = randomUUID();
    const maria = randomUUID();
    const admin = randomUUID();
    tx.insert(s.users)
      .values([
        { id: alex, email: DEMO_ACCOUNTS.customer.email, name: DEMO_ACCOUNTS.customer.name, phone: "+63 917 555 0142", passwordHash: pw(DEMO_ACCOUNTS.customer.password), createdAt: daysAgo(120), notes: "VIP. Prefers GCash." },
        { id: maria, email: DEMO_ACCOUNTS.customer2.email, name: DEMO_ACCOUNTS.customer2.name, phone: "+63 918 555 0199", passwordHash: pw(DEMO_ACCOUNTS.customer2.password), createdAt: daysAgo(45) },
        { id: admin, email: DEMO_ACCOUNTS.superAdmin.email, name: DEMO_ACCOUNTS.superAdmin.name, passwordHash: pw(DEMO_ACCOUNTS.superAdmin.password), role: "admin", adminRole: "super_admin" },
        { id: randomUUID(), email: DEMO_ACCOUNTS.catalogManager.email, name: DEMO_ACCOUNTS.catalogManager.name, passwordHash: pw(DEMO_ACCOUNTS.catalogManager.password), role: "admin", adminRole: "catalog_manager" },
        { id: randomUUID(), email: DEMO_ACCOUNTS.fulfillment.email, name: DEMO_ACCOUNTS.fulfillment.name, passwordHash: pw(DEMO_ACCOUNTS.fulfillment.password), role: "admin", adminRole: "fulfillment_support" },
      ])
      .run();

    const alexAddress: s.ShippingAddress = {
      fullName: "Alex Rivera",
      phone: "+63 917 555 0142",
      line1: "Unit 1207, The Residences at Greenbelt",
      line2: "Esperanza St.",
      city: "Makati City",
      province: "Metro Manila",
      postalCode: "1228",
      country: "PH",
    };
    const mariaAddress: s.ShippingAddress = {
      fullName: "Maria Santos",
      phone: "+63 918 555 0199",
      line1: "1 Unamonte Jomes",
      line2: "San Pablo",
      city: "Angono",
      province: "Rizal",
      postalCode: "1930",
      country: "PH",
    };
    tx.insert(s.addresses)
      .values([
        { id: randomUUID(), userId: alex, label: "Home", isDefault: true, ...alexAddress },
        { id: randomUUID(), userId: alex, label: "Office", ...alexAddress, line1: "32nd St. cor. 5th Ave., One Bonifacio High Street", line2: "BGC", city: "Taguig City", postalCode: "1634" },
        { id: randomUUID(), userId: maria, label: "Home", isDefault: true, ...mariaAddress },
      ])
      .run();

    const variantBySku = new Map<string, s.ProductVariant>();
    for (const p of SEED_PRODUCTS) {
      const { variants, daysOld, ...product } = p;
      tx.insert(s.products).values({ ...product, status: "active", createdAt: daysAgo(daysOld), updatedAt: daysAgo(daysOld) }).run();
      for (const v of variants) {
        const row: s.ProductVariant = {
          id: randomUUID(),
          productId: p.id,
          sku: v.sku,
          color: v.color ?? null,
          colorHex: v.colorHex ?? null,
          size: v.size ?? null,
          material: v.material ?? null,
          priceOverride: v.priceOverride ?? null,
          stock: v.stock,
          reorderThreshold: v.reorderThreshold ?? 5,
          version: 1,
        };
        tx.insert(s.productVariants).values(row).run();
        variantBySku.set(v.sku, row);
      }
    }

    const now = Date.now();
    tx.insert(s.promoCodes)
      .values([
        { id: randomUUID(), code: "WELCOME10", description: "10% off your first order", type: "percent", value: 10, perUserLimit: 1 },
        { id: randomUUID(), code: "SAVE100", description: "₱100 off orders over ₱1,000", type: "fixed", value: 100_00, minSubtotal: 1_000_00 },
        { id: randomUUID(), code: "FREESHIP", description: "Free standard shipping, stacks with one other code", type: "free_shipping", stackable: true },
        { id: randomUUID(), code: "HOLIDAY15", description: "15% off ₱5,000+ through New Year", type: "percent", value: 15, minSubtotal: 5_000_00, usageLimit: 100, startsAt: new Date(now - 7 * DAY), endsAt: new Date(now + 45 * DAY) },
        { id: randomUUID(), code: "SUMMER25", description: "Expired summer campaign", type: "percent", value: 25, startsAt: new Date(now - 200 * DAY), endsAt: new Date(now - 100 * DAY), active: true },
      ])
      .run();

    const productById = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
    const makeOrder = (opts: {
      userId: string;
      email: string;
      address: s.ShippingAddress;
      items: { sku: string; qty: number }[];
      status: s.OrderStatus;
      age: number;
      payment: s.PaymentMethod;
      tracking?: string;
    }) => {
      const lines = opts.items.map(({ sku, qty }) => {
        const v = variantBySku.get(sku)!;
        const p = productById.get(v.productId)!;
        return { v, p, unitPrice: v.priceOverride ?? p.basePrice, qty };
      });
      const totals = computeTotals({
        lines: lines.map((l) => ({ productId: l.p.id, variantId: l.v.id, unitPrice: l.unitPrice, quantity: l.qty, tierPricing: l.p.tierPricing })),
        bundles: BUNDLES,
        shippingTier: "standard",
      });
      const created = daysAgo(opts.age);
      const eta = deliveryWindow("standard", created);
      const orderId = randomUUID();
      tx.insert(s.orders)
        .values({
          id: orderId,
          number: orderNumber(),
          userId: opts.userId,
          idempotencyKey: randomUUID(),
          status: opts.status,
          email: opts.email,
          shippingAddress: opts.address,
          paymentMethod: opts.payment,
          paymentLast4: opts.payment === "card" ? "4242" : null,
          subtotal: totals.subtotal,
          tierDiscount: totals.tierDiscount,
          bundleDiscount: totals.bundleDiscount,
          promoDiscount: totals.promoDiscount,
          shippingFee: totals.shippingFee,
          taxIncluded: totals.taxIncluded,
          total: totals.total,
          carrier: opts.tracking ? "J&T Express" : null,
          trackingNumber: opts.tracking ?? null,
          etaFrom: eta.from,
          etaTo: eta.to,
          createdAt: created,
          updatedAt: created,
        })
        .run();
      for (const l of lines) {
        tx.insert(s.orderItems)
          .values({
            id: randomUUID(),
            orderId,
            productId: l.p.id,
            variantId: l.v.id,
            name: l.p.name,
            sku: l.v.sku,
            variantLabel: [l.v.color, l.v.size, l.v.material].filter(Boolean).join(" · ") || "Standard",
            image: l.p.images[0]?.src ?? null,
            unitPrice: l.unitPrice,
            quantity: l.qty,
            lineTotal: l.unitPrice * l.qty,
          })
          .run();
      }
      const flow: s.OrderStatus[] = ["pending", "paid", "packed", "shipped", "delivered"];
      const reached = opts.status === "cancelled" ? ["pending", "cancelled"] : flow.slice(0, flow.indexOf(opts.status) + 1);
      reached.forEach((status, i) =>
        tx.insert(s.orderEvents)
          .values({
            id: randomUUID(),
            orderId,
            status,
            note: status === "shipped" && opts.tracking ? `Handed to J&T Express · ${opts.tracking}` : null,
            createdAt: new Date(created.getTime() + i * 0.6 * DAY),
          })
          .run(),
      );
      return orderId;
    };

    makeOrder({ userId: alex, email: DEMO_ACCOUNTS.customer.email, address: alexAddress, items: [{ sku: "APL-AP2-WHT", qty: 1 }, { sku: "APL-C13PM-SUN", qty: 1 }], status: "delivered", age: 28, payment: "card", tracking: "JT7800123456" });
    makeOrder({ userId: alex, email: DEMO_ACCOUNTS.customer.email, address: alexAddress, items: [{ sku: "EMS-BJ-NVY-M", qty: 1 }, { sku: "EMA-NOIR-MESH", qty: 1 }], status: "shipped", age: 3, payment: "gcash", tracking: "JT7800987654" });
    makeOrder({ userId: alex, email: DEMO_ACCOUNTS.customer.email, address: alexAddress, items: [{ sku: "EMH-CAT-S", qty: 2 }], status: "paid", age: 0.2, payment: "card" });
    makeOrder({ userId: maria, email: DEMO_ACCOUNTS.customer2.email, address: mariaAddress, items: [{ sku: "APL-IP15P-NT-256", qty: 1 }, { sku: "APL-C13PM-PNK", qty: 1 }], status: "delivered", age: 15, payment: "card", tracking: "JT7800555111" });
    makeOrder({ userId: maria, email: DEMO_ACCOUNTS.customer2.email, address: mariaAddress, items: [{ sku: "EMH-CAT-L", qty: 3 }], status: "pending", age: 1, payment: "cod" });
    makeOrder({ userId: maria, email: DEMO_ACCOUNTS.customer2.email, address: mariaAddress, items: [{ sku: "APL-AVP-256", qty: 1 }], status: "cancelled", age: 9, payment: "card" });

    const reviewSeed: [string, string, number, string, string, boolean][] = [
      ["prd_airpods2", "Alex R.", 5, "Instant pairing", "Opened the case next to my phone and it was connected in two seconds. Battery easily lasts my commute both ways.", true],
      ["prd_airpods2", "Kim D.", 4, "Great sound, snug fit", "Clear mids and decent bass. Takes a day to get used to the fit.", true],
      ["prd_airpods2", "Rafa L.", 4, "Solid daily driver", "Mic quality on calls is better than I expected.", false],
      ["prd_catplush", "Maria S.", 5, "My cat is jealous", "So soft and the whiskers are actually stitched. Bought a large one for the sofa.", true],
      ["prd_catplush", "Joy P.", 5, "Perfect gift", "Arrived well packed and fluffier than in photos.", true],
      ["prd_catplush", "Ken T.", 3, "Smaller than expected", "Cute, but get the large if you want it as a floor cushion.", false],
      ["prd_bluejacket", "Ian M.", 5, "Heavyweight and warm", "Great for air-conditioned offices. Size M fits true.", true],
      ["prd_bluejacket", "Leah C.", 4, "Love the print", "Wish it came in black too.", false],
      ["prd_blackwatch", "Marco V.", 5, "Very demure indeed", "Looks far more expensive than it is. Mesh strap is comfortable.", true],
      ["prd_blackwatch", "Ana G.", 4, "Clean design", "The dial is hard to read in very low light, otherwise perfect.", false],
      ["prd_ip13case", "Alex R.", 5, "MagSafe snaps hard", "Grippy, and the Sunglow colour is gorgeous in person.", true],
      ["prd_ip13case", "Bea L.", 4, "Good protection", "Survived a drop on tiles already.", true],
      ["prd_iphone15pro", "Maria S.", 5, "Feels so light", "Titanium makes a real difference. Camera is amazing at night.", true],
      ["prd_visionpro", "Carlo B.", 4, "Mind-blowing demo", "Incredible displays. Battery life is the only weak spot.", false],
    ];
    for (const [productId, author, rating, title, body, verified] of reviewSeed) {
      tx.insert(s.reviews)
        .values({ id: randomUUID(), productId, authorName: author, rating, title, body, verified, userId: author === "Alex R." ? alex : author === "Maria S." ? maria : null, createdAt: daysAgo(Math.floor(Math.random() * 30) + 1) })
        .run();
    }
    for (const p of SEED_PRODUCTS) {
      const rows = reviewSeed.filter((r) => r[0] === p.id);
      const avg = rows.length ? rows.reduce((a, r) => a + r[2], 0) / rows.length : 0;
      tx.update(s.products).set({ ratingAvg: Math.round(avg * 10) / 10, ratingCount: rows.length }).where(eq(s.products.id, p.id)).run();
    }

    const searches: [string, number, number][] = [
      ["airpods", 1, 6], ["jacket", 1, 4], ["sofa", 0, 5], ["desk lamp", 0, 3], ["iphone", 3, 7], ["vision pro", 1, 2], ["mechanical keyboard", 0, 4], ["watch", 1, 3],
    ];
    for (const [query, resultCount, times] of searches) {
      for (let i = 0; i < times; i++) tx.insert(s.searchQueries).values({ id: randomUUID(), query, resultCount, createdAt: daysAgo(i) }).run();
    }

    const abandoned: [string, number][] = [["APL-IP15P-BT-256", 1], ["APL-AVP-256", 1], ["EMS-BJ-NVY-L", 2]];
    for (const [sku, qty] of abandoned) {
      tx.insert(s.cartItems).values({ id: randomUUID(), ownerKey: `g:seed-${sku}`, variantId: variantBySku.get(sku)!.id, quantity: qty, createdAt: daysAgo(3), updatedAt: daysAgo(3) }).run();
    }

    tx.insert(s.auditLogs)
      .values([
        { id: randomUUID(), actorId: admin, actorEmail: DEMO_ACCOUNTS.superAdmin.email, action: "product.update", entityType: "product", entityId: "prd_catplush", before: { basePrice: 349_00 }, after: { basePrice: 299_00 }, reason: "Holiday markdown", createdAt: daysAgo(2) },
        { id: randomUUID(), actorId: admin, actorEmail: DEMO_ACCOUNTS.superAdmin.email, action: "variant.stock", entityType: "variant", entityId: "EMS-BJ-NVY-M", before: { stock: 4 }, after: { stock: 14 }, reason: "Restock delivery", createdAt: daysAgo(1) },
      ])
      .run();
  });
}
