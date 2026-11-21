import { BadgePercent } from "lucide-react";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/auth-forms";
import { safeRedirect } from "@/lib/security/redirect";
import { sandboxEnabled } from "@/server/sandbox";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function RegisterPage({ searchParams }: Props) {
  const raw = (await searchParams).next;
  const next = safeRedirect(Array.isArray(raw) ? raw[0] : raw, "/account");
  return (
    <div className="blob-card w-full max-w-[32rem] rounded-xl p-6 sm:p-10">
      <h1 className="text-3xl font-light">Create your account</h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        <BadgePercent className="size-4 text-price" aria-hidden /> Members get 10% off their first order with WELCOME10.
      </p>
      <div className="mt-8">
        <RegisterForm next={next} sandbox={sandboxEnabled()} />
      </div>
    </div>
  );
}
