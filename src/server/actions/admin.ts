"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { bulkProductActionSchema, customerAdminSchema, orderTransitionSchema, productInputSchema, promoInputSchema } from "@/lib/validations/admin";
import { requireAdmin } from "../auth/guards";
import { revokeAllSessions } from "../auth/session";
import { adminCommandIndex, bulkProducts, deleteProduct, setProductStatus, updateCustomer, upsertProduct, upsertPromo } from "../services/admin";
import { transitionOrder } from "../services/orders";
import { ok, runAction, zodFailure } from "./run";

const idSchema = z.string().min(1).max(64);

export async function saveProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("admin.product.save", async () => {
    const admin = await requireAdmin("catalog:write");
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const id = upsertProduct(admin, parsed.data);
    revalidatePath("/admin/products");
    revalidatePath("/");
    return ok({ id }, parsed.data.id ? "Product saved" : "Product created");
  });
}

export async function setProductStatusAction(productId: unknown, status: unknown): Promise<ActionResult> {
  return runAction("admin.product.status", async () => {
    const admin = await requireAdmin("catalog:write");
    setProductStatus(admin, idSchema.parse(productId), z.enum(["active", "draft", "archived"]).parse(status));
    revalidatePath("/admin/products");
    return ok(null, "Status updated");
  });
}

export async function deleteProductAction(productId: unknown): Promise<ActionResult<{ result: "deleted" | "archived" }>> {
  return runAction("admin.product.delete", async () => {
    const admin = await requireAdmin("catalog:delete");
    const result = deleteProduct(admin, idSchema.parse(productId));
    revalidatePath("/admin/products");
    return ok({ result }, result === "deleted" ? "Product deleted" : "Product has orders, so it was archived instead");
  });
}

export async function bulkProductAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction("admin.product.bulk", async () => {
    const parsed = bulkProductActionSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const admin = await requireAdmin("catalog:write");
    const count = bulkProducts(admin, parsed.data.productIds, parsed.data.action, parsed.data.value);
    revalidatePath("/admin/products");
    return ok({ count }, `Updated ${count} product${count === 1 ? "" : "s"}`);
  });
}

export async function transitionOrderAction(input: unknown): Promise<ActionResult> {
  return runAction("admin.order.transition", async () => {
    const parsed = orderTransitionSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const admin = await requireAdmin(parsed.data.to === "refunded" ? "orders:refund" : "orders:fulfill");
    transitionOrder(admin, parsed.data);
    revalidatePath("/admin/orders");
    revalidatePath(`/orders/${parsed.data.orderId}`);
    return ok(null, `Order moved to ${parsed.data.to}`);
  });
}

export async function updateCustomerAction(input: unknown): Promise<ActionResult> {
  return runAction("admin.customer.update", async () => {
    const parsed = customerAdminSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const admin = await requireAdmin(parsed.data.status ? "customers:manage" : "customers:view");
    const suspended = updateCustomer(admin, parsed.data.userId, parsed.data);
    if (suspended) revokeAllSessions(parsed.data.userId);
    revalidatePath("/admin/customers");
    return ok(null, suspended ? "Customer suspended and signed out everywhere" : "Customer updated");
  });
}

export async function savePromoAction(input: unknown): Promise<ActionResult> {
  return runAction("admin.promo.save", async () => {
    const admin = await requireAdmin("promotions:write");
    const parsed = promoInputSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    upsertPromo(admin, parsed.data);
    revalidatePath("/admin/promotions");
    return ok(null, parsed.data.id ? "Promotion updated" : "Promotion created");
  });
}

export async function adminCommandSearchAction(q: unknown) {
  await requireAdmin("dashboard:view");
  const query = z.string().trim().min(2).max(40).safeParse(q);
  return query.success ? adminCommandIndex(query.data) : { orders: [], skus: [] };
}
