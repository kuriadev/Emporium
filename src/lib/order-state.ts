export type OrderStatusValue = "pending" | "paid" | "packed" | "shipped" | "delivered" | "cancelled" | "refunded";

export const ORDER_FLOW: readonly OrderStatusValue[] = ["pending", "paid", "packed", "shipped", "delivered"];

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatusValue, readonly OrderStatusValue[]>> = {
  pending: ["paid", "cancelled"],
  paid: ["packed", "cancelled", "refunded"],
  packed: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const STATUS_LABEL: Record<OrderStatusValue, string> = {
  pending: "Pending",
  paid: "Paid",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Customers may self-cancel until the parcel leaves the warehouse. */
export const CUSTOMER_CANCELLABLE: readonly OrderStatusValue[] = ["pending", "paid", "packed"];

export const RETURN_WINDOW_DAYS = 30;

/** Stock goes back on the shelf when an order is cancelled, or refunded before it shipped. */
export function restocksOn(from: OrderStatusValue, to: OrderStatusValue): boolean {
  if (to === "cancelled") return true;
  return to === "refunded" && (from === "paid" || from === "packed");
}
