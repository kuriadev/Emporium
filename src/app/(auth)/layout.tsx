import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <Image src="/images/brand/auth-blobs.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-80" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_45%,transparent,oklch(0_0_0/0.75))]" />
      <header className="shell flex h-[4.5rem] items-center justify-between">
        <Logo />
        <Link href="/" className="inline-flex min-h-tap items-center gap-2 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Back to store
        </Link>
      </header>
      <main id="main" className="grid flex-1 place-items-center px-gutter pb-16 pt-4">
        {children}
      </main>
    </div>
  );
}
