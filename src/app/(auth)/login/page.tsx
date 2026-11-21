import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeRedirect } from "@/lib/security/redirect";
import { sandboxAccounts } from "@/server/sandbox";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const raw = (await searchParams).next;
  // Validate early so the form only ever carries a same-site path; the server action re-validates.
  const next = safeRedirect(Array.isArray(raw) ? raw[0] : raw, "/account");
  const checkoutBound = next.startsWith("/checkout");
  return (
    <div className="blob-card w-full max-w-[30rem] rounded-xl p-6 sm:p-10">
      <h1 className="text-3xl font-light">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">{checkoutBound ? "Sign in to finish checking out. Your bag comes with you." : "Sign in to track orders, save addresses and sync your wishlist."}</p>
      <div className="mt-8">
        <LoginForm scope="customer" next={next} sandbox={sandboxAccounts("customer")} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        New to Emporium?{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-accent underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
