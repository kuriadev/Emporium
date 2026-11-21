import type { AdminRole } from "../db/schema";

export const PERMISSIONS = {
  "dashboard:view": ["super_admin", "catalog_manager", "fulfillment_support"],
  "catalog:write": ["super_admin", "catalog_manager"],
  "catalog:delete": ["super_admin"],
  "orders:view": ["super_admin", "fulfillment_support", "catalog_manager"],
  "orders:fulfill": ["super_admin", "fulfillment_support"],
  "orders:refund": ["super_admin"],
  "customers:view": ["super_admin", "fulfillment_support"],
  "customers:manage": ["super_admin"],
  "promotions:write": ["super_admin", "catalog_manager"],
  "audit:view": ["super_admin"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(adminRole: AdminRole | null | undefined, permission: Permission): boolean {
  return !!adminRole && (PERMISSIONS[permission] as readonly AdminRole[]).includes(adminRole);
}

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  catalog_manager: "Catalog Manager",
  fulfillment_support: "Fulfillment Support",
};
