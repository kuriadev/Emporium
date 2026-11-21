import { describe, expect, it } from "vitest";
import { CUSTOMER_CANCELLABLE, ORDER_TRANSITIONS, canTransition, restocksOn, type OrderStatusValue } from "@/lib/order-state";

describe("order state machine", () => {
  it("follows Pending → Paid → Packed → Shipped → Delivered", () => {
    expect(canTransition("pending", "paid")).toBe(true);
    expect(canTransition("paid", "packed")).toBe(true);
    expect(canTransition("packed", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("rejects skips, reversals and edits to terminal orders", () => {
    expect(canTransition("pending", "shipped")).toBe(false);
    expect(canTransition("delivered", "shipped")).toBe(false);
    expect(canTransition("shipped", "cancelled")).toBe(false);
    for (const to of Object.keys(ORDER_TRANSITIONS) as OrderStatusValue[]) {
      expect(canTransition("cancelled", to)).toBe(false);
      expect(canTransition("refunded", to)).toBe(false);
    }
  });

  it("lets customers cancel only before shipping", () => {
    expect(CUSTOMER_CANCELLABLE).toEqual(["pending", "paid", "packed"]);
  });

  it("restocks on cancellation and on refunds of unshipped orders only", () => {
    expect(restocksOn("paid", "cancelled")).toBe(true);
    expect(restocksOn("packed", "refunded")).toBe(true);
    expect(restocksOn("shipped", "refunded")).toBe(false);
    expect(restocksOn("delivered", "refunded")).toBe(false);
  });
});
