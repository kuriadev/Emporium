import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/server/auth/guards";
import { adminNavCounts } from "@/server/services/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Emporium Admin" },
  robots: { index: false, follow: false },
};

/**
 * The proxy already bounces non-staff away from /admin; this layout re-checks against the live
 * session row (suspension, revoked sessions) and each page checks its own permission again.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <AdminShell user={{ name: admin.name, email: admin.email, adminRole: admin.adminRole }} counts={adminNavCounts()}>
      {children}
    </AdminShell>
  );
}
