import "server-only";
import type { SandboxAccount } from "@/components/auth/auth-forms";
import { DEMO_ACCOUNTS } from "./db/seed";

/**
 * Demo conveniences (credential autofill, test cards) are on by default so the sandbox is easy to
 * evaluate. Set EMPORIUM_SANDBOX=0 in production to remove them from every rendered page.
 */
export const sandboxEnabled = () => process.env.EMPORIUM_SANDBOX !== "0";

export function sandboxAccounts(scope: "customer" | "admin"): SandboxAccount[] {
  if (!sandboxEnabled()) return [];
  const d = DEMO_ACCOUNTS;
  return scope === "customer"
    ? [
        { label: d.customer.name, hint: "Customer · has orders", email: d.customer.email, password: d.customer.password },
        { label: d.customer2.name, hint: "Customer · new", email: d.customer2.email, password: d.customer2.password },
      ]
    : [
        { label: "Super Admin", hint: d.superAdmin.email, email: d.superAdmin.email, password: d.superAdmin.password },
        { label: "Catalog Manager", hint: d.catalogManager.email, email: d.catalogManager.email, password: d.catalogManager.password },
        { label: "Fulfillment", hint: d.fulfillment.email, email: d.fulfillment.email, password: d.fulfillment.password },
      ];
}
