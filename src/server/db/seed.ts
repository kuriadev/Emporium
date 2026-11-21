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

/** Small deterministic PRNG so the seeded history is stable between resets. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fictional shoppers (example.com addresses) that give the CRM and reports realistic history. */
const HISTORY_SHOPPERS: { name: string; email: string; phone: string; line1: string; line2: string; city: string; province: string; postalCode: string; notes?: string; suspended?: boolean }[] = [
  { name: "Carlo Bautista", email: "carlo.bautista@example.com", phone: "+63 917 555 0101", line1: "18 Maginhawa St.", line2: "Teachers Village East", city: "Quezon City", province: "Metro Manila", postalCode: "1101", notes: "Buys gadgets at launch. Offer pre-order access." },
  { name: "Joy Panganiban", email: "joy.panganiban@example.com", phone: "+63 917 555 0102", line1: "Unit 9C, The Grove by Rockwell", line2: "E. Rodriguez Jr. Ave.", city: "Pasig City", province: "Metro Manila", postalCode: "1604" },
  { name: "Ken Tan", email: "ken.tan@example.com", phone: "+63 917 555 0103", line1: "88 Salinas Drive", line2: "Lahug", city: "Cebu City", province: "Cebu", postalCode: "6000" },
  { name: "Leah Cruz", email: "leah.cruz@example.com", phone: "+63 917 555 0104", line1: "45 J.P. Laurel Ave.", line2: "Bajada", city: "Davao City", province: "Davao del Sur", postalCode: "8000", notes: "Asked for gift receipts on every order." },
  { name: "Ian Mendoza", email: "ian.mendoza@example.com", phone: "+63 917 555 0105", line1: "3F, 11th Ave. cor. 28th St.", line2: "Bonifacio Global City", city: "Taguig City", province: "Metro Manila", postalCode: "1634" },
  { name: "Ana Gonzales", email: "ana.gonzales@example.com", phone: "+63 917 555 0106", line1: "Tower 2, 600 Shaw Blvd.", line2: "Wack-Wack", city: "Mandaluyong City", province: "Metro Manila", postalCode: "1550" },
  { name: "Rafa Lim", email: "rafa.lim@example.com", phone: "+63 917 555 0107", line1: "12 Diversion Rd.", line2: "Mandurriao", city: "Iloilo City", province: "Iloilo", postalCode: "5000", notes: "Card chargeback opened on a delivered order. Suspended pending review.", suspended: true },
  { name: "Kim Dizon", email: "kim.dizon@example.com", phone: "+63 917 555 0108", line1: "27 Aguirre Ave.", line2: "BF Homes", city: "Parañaque City", province: "Metro Manila", postalCode: "1700" },
  { name: "Marco Villanueva", email: "marco.villanueva@example.com", phone: "+63 917 555 0109", line1: "5 Session Rd.", line2: "Kayang-Hilltop", city: "Baguio City", province: "Benguet", postalCode: "2600" },
  { name: "Bea Lopez", email: "bea.lopez@example.com", phone: "+63 917 555 0110", line1: "40 Wilson St.", line2: "Greenhills", city: "San Juan City", province: "Metro Manila", postalCode: "1500" },
];

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
    const PROMOS = {
      WELCOME10: { id: randomUUID(), code: "WELCOME10", description: "10% off your first order", type: "percent", value: 10, minSubtotal: 0, perUserLimit: 1, stackable: false },
      SAVE100: { id: randomUUID(), code: "SAVE100", description: "₱100 off orders over ₱1,000", type: "fixed", value: 100_00, minSubtotal: 1_000_00, stackable: false },
      FREESHIP: { id: randomUUID(), code: "FREESHIP", description: "Free standard shipping, stacks with one other code", type: "free_shipping", value: 0, minSubtotal: 0, stackable: true },
    } as const satisfies Record<string, Omit<s.PromoCode, "createdAt" | "usedCount" | "startsAt" | "endsAt" | "usageLimit" | "perUserLimit" | "active"> & { perUserLimit?: number }>;
    tx.insert(s.promoCodes)
      .values([
        ...Object.values(PROMOS),
        { id: randomUUID(), code: "HOLIDAY15", description: "15% off ₱5,000+ through New Year", type: "percent", value: 15, minSubtotal: 5_000_00, usageLimit: 100, startsAt: new Date(now - 7 * DAY), endsAt: new Date(now + 45 * DAY) },
        { id: randomUUID(), code: "SUMMER25", description: "Expired summer campaign", type: "percent", value: 25, startsAt: new Date(now - 200 * DAY), endsAt: new Date(now - 100 * DAY), active: true },
      ])
      .run();

    const productById = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
    // Days after checkout at which each milestone is stamped on seeded orders.
    const MILESTONE_AT: Record<string, number> = { pending: 0, paid: 0.01, packed: 0.4, shipped: 0.9, delivered: 3.2, return_requested: 4.5, partial_refund: 6, refunded: 6, cancelled: 0.2 };
    const makeOrder = (opts: {
      userId: string;
      email: string;
      address: s.ShippingAddress;
      items: { sku: string; qty: number }[];
      status: s.OrderStatus;
      age: number;
      payment: s.PaymentMethod;
      tracking?: string;
      carrier?: string;
      promo?: keyof typeof PROMOS;
      shippingTier?: s.ShippingTier;
      /** Goodwill credit in centavos, refunded while the order stays delivered (partial refund). */
      partialRefund?: number;
      returnReason?: string;
    }) => {
      const lines = opts.items.map(({ sku, qty }) => {
        const v = variantBySku.get(sku)!;
        const p = productById.get(v.productId)!;
        return { v, p, unitPrice: v.priceOverride ?? p.basePrice, qty };
      });
      const promo = opts.promo ? PROMOS[opts.promo] : null;
      const totals = computeTotals({
        lines: lines.map((l) => ({ productId: l.p.id, variantId: l.v.id, unitPrice: l.unitPrice, quantity: l.qty, tierPricing: l.p.tierPricing })),
        bundles: BUNDLES,
        promos: promo ? [promo] : [],
        shippingTier: opts.shippingTier ?? "standard",
      });
      const created = daysAgo(opts.age);
      const eta = deliveryWindow(opts.shippingTier ?? "standard", created);
      const orderId = randomUUID();

      const flow: s.OrderStatus[] = ["pending", "paid", "packed", "shipped", "delivered"];
      const reached: string[] =
        opts.status === "cancelled"
          ? ["pending", "paid", "cancelled"]
          : opts.status === "refunded"
            ? [...flow, "refunded"]
            : flow.slice(0, flow.indexOf(opts.status) + 1);
      if (opts.returnReason) reached.push("return_requested");
      if (opts.partialRefund) reached.push("partial_refund");
      const stamp = (status: string) => new Date(Math.min(Date.now(), created.getTime() + (MILESTONE_AT[status] ?? 0) * DAY));

      const refundedAmount =
        opts.status === "refunded" || opts.status === "cancelled" ? totals.total : opts.partialRefund ? Math.min(opts.partialRefund, totals.total) : 0;
      const carrier = opts.tracking ? (opts.carrier ?? "J&T Express") : null;
      const last = reached.at(-1)!;

      tx.insert(s.orders)
        .values({
          id: orderId,
          number: orderNumber(),
          userId: opts.userId,
          idempotencyKey: randomUUID(),
          status: opts.status,
          returnStatus: opts.returnReason ? "requested" : "none",
          returnReason: opts.returnReason ?? null,
          email: opts.email,
          shippingAddress: opts.address,
          shippingTier: opts.shippingTier ?? "standard",
          paymentMethod: opts.payment,
          paymentLast4: opts.payment === "card" ? "4242" : opts.payment === "gcash" ? "4567" : null,
          subtotal: totals.subtotal,
          tierDiscount: totals.tierDiscount,
          bundleDiscount: totals.bundleDiscount,
          promoDiscount: totals.promoDiscount,
          shippingFee: totals.shippingFee,
          taxIncluded: totals.taxIncluded,
          total: totals.total,
          refundedAmount,
          promoCodes: totals.promos.filter((x) => x.applied).map((x) => x.code),
          carrier,
          trackingNumber: opts.tracking ?? null,
          etaFrom: eta.from,
          etaTo: eta.to,
          createdAt: created,
          // Delivered orders keep their delivery time here: the customer return window counts from it.
          updatedAt: stamp(opts.returnReason || opts.partialRefund ? "delivered" : last),
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
      const peso = (c: number) => `₱${(c / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
      const NOTES: Record<string, string | null> = {
        shipped: carrier ? `Handed to ${carrier} · ${opts.tracking}` : null,
        cancelled: "Cancelled by customer: Ordered the wrong size",
        refunded: `Refunded ${peso(refundedAmount)} — Item arrived damaged`,
        return_requested: opts.returnReason ?? null,
        partial_refund: `Partial refund ${peso(refundedAmount)} — Goodwill credit for late delivery`,
      };
      reached.forEach((status) =>
        tx.insert(s.orderEvents)
          .values({ id: randomUUID(), orderId, status, note: NOTES[status] ?? null, createdAt: stamp(status) })
          .run(),
      );
      const applied = totals.promos.find((x) => x.applied);
      if (promo && applied && applied.amount > 0) {
        tx.insert(s.promoRedemptions).values({ id: randomUUID(), promoId: promo.id, userId: opts.userId, orderId, amount: applied.amount, createdAt: created }).run();
      }
      return orderId;
    };

    makeOrder({ userId: alex, email: DEMO_ACCOUNTS.customer.email, address: alexAddress, items: [{ sku: "APL-AP2-WHT", qty: 1 }, { sku: "APL-C13PM-SUN", qty: 1 }], status: "delivered", age: 28, payment: "card", tracking: "JT7800123456" });
    makeOrder({ userId: alex, email: DEMO_ACCOUNTS.customer.email, address: alexAddress, items: [{ sku: "EMS-BJ-NVY-M", qty: 1 }, { sku: "EMA-NOIR-MESH", qty: 1 }], status: "shipped", age: 3, payment: "gcash", tracking: "JT7800987654" });
    makeOrder({ userId: alex, email: DEMO_ACCOUNTS.customer.email, address: alexAddress, items: [{ sku: "EMH-CAT-S", qty: 2 }], status: "paid", age: 0.2, payment: "card" });
    makeOrder({ userId: maria, email: DEMO_ACCOUNTS.customer2.email, address: mariaAddress, items: [{ sku: "APL-IP15P-NT-256", qty: 1 }, { sku: "APL-C13PM-PNK", qty: 1 }], status: "delivered", age: 15, payment: "card", tracking: "JT7800555111" });
    makeOrder({ userId: maria, email: DEMO_ACCOUNTS.customer2.email, address: mariaAddress, items: [{ sku: "EMH-CAT-L", qty: 3 }], status: "pending", age: 1, payment: "cod" });
    makeOrder({ userId: maria, email: DEMO_ACCOUNTS.customer2.email, address: mariaAddress, items: [{ sku: "APL-AVP-256", qty: 1 }], status: "cancelled", age: 9, payment: "card" });

    // ── 90 days of store history so the admin dashboard, CRM and promo reports have real signal ──
    const rand = mulberry32(20261121);
    const pick = <T,>(items: readonly (readonly [T, number])[]): T => {
      const total = items.reduce((a, [, w]) => a + w, 0);
      let r = rand() * total;
      for (const [item, w] of items) if ((r -= w) < 0) return item;
      return items[0]![0];
    };
    // Shoppers below cannot sign in: they share one hash of a random, never-disclosed secret.
    const lockedHash = pw(randomUUID());
    const shoppers = HISTORY_SHOPPERS.map((c, i) => {
      const id = randomUUID();
      const address: s.ShippingAddress = { fullName: c.name, phone: c.phone, line1: c.line1, line2: c.line2, city: c.city, province: c.province, postalCode: c.postalCode, country: "PH" };
      tx.insert(s.users)
        .values({ id, email: c.email, name: c.name, phone: c.phone, passwordHash: lockedHash, status: c.suspended ? "suspended" : "active", notes: c.notes ?? "", createdAt: daysAgo(96 + i * 9) })
        .run();
      tx.insert(s.addresses).values({ id: randomUUID(), userId: id, label: "Home", isDefault: true, ...address }).run();
      return { id, email: c.email, address };
    });

    const BASKET: (readonly [string, number])[] = [
      ["EMH-CAT-S", 14], ["EMH-CAT-L", 6], ["APL-C13PM-SUN", 10], ["APL-C13PM-MUL", 6], ["APL-C13PM-PNK", 3],
      ["EMA-NOIR-MESH", 10], ["EMA-NOIR-LTHR", 5], ["EMS-BJ-NVY-M", 8], ["EMS-BJ-NVY-L", 6], ["EMS-BJ-NVY-S", 4],
      ["APL-AP2-WHT", 8], ["APL-IP15P-NT-128", 2], ["APL-IP15P-BT-128", 2], ["APL-IP15P-NT-256", 1], ["APL-AVP-256", 1],
    ];
    const CARRIERS = [["J&T Express", "JT78", 8], ["LBC Express", "LBC", 9], ["Ninja Van", "NVPH", 9]] as const;
    const RETURN_REASONS = ["Size runs small, need a large", "Colour looks different from the photos", "Changed my mind"];
    let returnsLeft = 2;
    let partialLeft = 1;
    const welcomed = new Set<string>();

    for (let n = 0; n < 72; n++) {
      // Weighted toward the last 30 days so the dashboard shows month-over-month growth.
      const r = rand();
      const age = r < 0.45 ? rand() * 30 : r < 0.75 ? 30 + rand() * 30 : 60 + rand() * 30;
      const shopper = shoppers[Math.floor(rand() * shoppers.length)]!;
      const lineCount = rand() < 0.62 ? 1 : rand() < 0.75 ? 2 : 3;
      const skus = new Set<string>();
      while (skus.size < lineCount) skus.add(pick(BASKET));
      const items = [...skus].map((sku) => ({ sku, qty: rand() < 0.8 ? 1 : 2 }));

      let status: s.OrderStatus;
      if (age < 0.4) status = rand() < 0.35 ? "pending" : "paid";
      else if (age < 0.9) status = rand() < 0.5 ? "paid" : "packed";
      else if (age < 3.2) status = rand() < 0.25 ? "packed" : "shipped";
      else {
        const roll = rand();
        status = roll < 0.06 ? "cancelled" : roll < 0.13 ? "refunded" : "delivered";
      }
      const [carrier, prefix, digits] = CARRIERS[Math.floor(rand() * CARRIERS.length)]!;
      const tracking = ["shipped", "delivered", "refunded"].includes(status) ? prefix + String(Math.floor(rand() * 10 ** digits)).padStart(digits, "0") : undefined;
      const recentDelivery = status === "delivered" && age > 5 && age < 20;
      const returnReason = recentDelivery && returnsLeft > 0 && rand() < 0.3 ? (returnsLeft--, RETURN_REASONS[returnsLeft % RETURN_REASONS.length]) : undefined;
      const partialRefund = !returnReason && status === "delivered" && age > 20 && partialLeft > 0 && rand() < 0.3 ? (partialLeft--, 250_00) : undefined;
      const promoRoll = rand();
      const promo = promoRoll < 0.12 && !welcomed.has(shopper.id) ? "WELCOME10" : promoRoll < 0.2 ? "SAVE100" : promoRoll < 0.26 ? "FREESHIP" : undefined;
      if (promo === "WELCOME10") welcomed.add(shopper.id);

      makeOrder({
        userId: shopper.id,
        email: shopper.email,
        address: shopper.address,
        items,
        status,
        age,
        payment: pick([["card", 6], ["gcash", 3], ["cod", 2]] as const),
        tracking,
        carrier,
        promo,
        shippingTier: rand() < 0.2 ? "express" : "standard",
        returnReason,
        partialRefund,
      });
    }

    // Today's fulfilment queue: fresh orders waiting to be paid, packed or shipped.
    const QUEUE: [number, s.OrderStatus, string][] = [
      [0.04, "pending", "EMH-CAT-S"], [0.1, "paid", "APL-AP2-WHT"], [0.22, "paid", "EMA-NOIR-MESH"], [0.5, "packed", "EMS-BJ-NVY-L"],
      [0.65, "packed", "APL-C13PM-MUL"], [1.3, "shipped", "APL-IP15P-NT-128"], [2.2, "shipped", "EMH-CAT-L"],
    ];
    QUEUE.forEach(([age, status, sku], i) => {
      const shopper = shoppers[(i * 3) % shoppers.length]!;
      makeOrder({ userId: shopper.id, email: shopper.email, address: shopper.address, items: [{ sku, qty: 1 }], status, age, payment: i % 3 === 0 ? "cod" : "card", tracking: status === "shipped" ? `NVPH${String(431_000_100 + i * 7919)}` : undefined, carrier: "Ninja Van" });
    });

    const used = tx
      .select({ promoId: s.promoRedemptions.promoId, n: count() })
      .from(s.promoRedemptions)
      .groupBy(s.promoRedemptions.promoId)
      .all();
    for (const u of used) tx.update(s.promoCodes).set({ usedCount: u.n }).where(eq(s.promoCodes.id, u.promoId)).run();

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
