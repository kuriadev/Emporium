import "server-only";
import { redirect } from "next/navigation";
import { can, type Permission } from "./permissions";
import { getCurrentUser, type SessionUser } from "./session";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
  ) {
    super(message);
  }
}

export type AdminUser = SessionUser & { role: "admin"; adminRole: NonNullable<SessionUser["adminRole"]> };

function isAdmin(user: SessionUser | null): user is AdminUser {
  return !!user && user.role === "admin" && !!user.adminRole;
}

/** For pages: redirects instead of throwing. */
export async function requireUserPage(next: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdminPage(permission: Permission = "dashboard:view", next = "/admin"): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  if (!can(user.adminRole, permission)) redirect("/admin?denied=" + encodeURIComponent(permission));
  return user;
}

/** For actions / route handlers: throws, caught by the action wrapper. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in to continue.", "UNAUTHENTICATED");
  return user;
}

export async function requireAdmin(permission: Permission): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new AuthError("Admin session required.", "UNAUTHENTICATED");
  if (!can(user.adminRole, permission)) throw new AuthError("Your admin role cannot perform this action.", "FORBIDDEN");
  return user;
}
