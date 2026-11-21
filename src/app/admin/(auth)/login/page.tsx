import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeRedirect } from "@/lib/security/redirect";
import { getCurrentUser } from "@/server/auth/session";
import { sandboxAccounts } from "@/server/sandbox";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ next?: string | string[]; reason?: string | string[] }> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeRedirect(first(sp.next), "/admin", { allowAdmin: true });
  const user = await getCurrentUser();
  if (user?.role === "admin" && user.adminRole) redirect(next);
  const customerSignedIn = user?.role === "customer" || first(sp.reason) === "staff-only";

  return (
    <div className="w-full max-w-[30rem] rounded-xl border border-line-strong bg-surface/85 p-6 shadow-[0_2rem_6rem_-2rem_oklch(0_0_0/0.9)] backdrop-blur-xl sm:p-10">
      <p className="text-2xs uppercase tracking-[0.3em] text-accent">Emporium admin</p>
      <h1 className="mt-2 text-3xl font-light">Staff sign in</h1>
      <p className="mt-2 text-sm text-muted">Use the work account your Super Admin set up for you.</p>
      {customerSignedIn && (
        <p role="status" className="mt-6 flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          The admin area is for staff accounts only. Sign in with a staff account to continue, or head back to the storefront.
        </p>
      )}
      <div className="mt-8">
        <LoginForm scope="admin" next={next} sandbox={sandboxAccounts("admin")} />
      </div>
    </div>
  );
}
