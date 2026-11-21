import { ArrowLeft, Clock, Fingerprint, ScrollText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";

const SAFEGUARDS = [
  { icon: ShieldCheck, title: "Role-based access", body: "Super Admin, Catalog Manager and Fulfillment Support each see only the tools their role allows." },
  { icon: Fingerprint, title: "Strict sign-in", body: "Three attempts per 15 minutes per account and network. Customer accounts can't enter here." },
  { icon: Clock, title: "Short sessions", body: "Staff sessions end after 8 hours, and suspending someone signs them out everywhere." },
  { icon: ScrollText, title: "Everything is audited", body: "Price, stock, order and customer changes are logged with a before and after." },
];

/** Deliberately different from the shopper sign-in: graph-paper surface, no imagery, security-first copy. */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [background-size:3rem_3rem] [mask-image:radial-gradient(70%_60%_at_60%_40%,black,transparent)]"
      />
      <aside className="relative hidden flex-col justify-between border-r border-line bg-surface/70 p-12 backdrop-blur-sm lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <Logo href="/" label="Emporium storefront" />
          <span className="rounded-pill border border-accent/50 px-3 py-1 text-2xs uppercase tracking-[0.3em] text-accent">Staff portal</span>
        </div>
        <div className="max-w-[30rem] space-y-8">
          <h2 className="text-[clamp(2.25rem,1.5rem+2vw,3.5rem)] font-light leading-[1.05]">
            Run the store.
            <span className="block text-gradient">Leave a trail.</span>
          </h2>
          <ul className="space-y-5">
            {SAFEGUARDS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md border border-line bg-bg/60 text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm text-fg">{title}</span>
                  <span className="block text-sm text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-subtle">Unauthorised access is prohibited. Sign-in attempts are rate limited and recorded.</p>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-[4.5rem] items-center justify-between px-gutter">
          <div className="flex items-center gap-3 lg:invisible">
            <Logo href="/" label="Emporium storefront" />
            <span className="rounded-pill border border-accent/50 px-3 py-1 text-2xs uppercase tracking-[0.3em] text-accent">Staff</span>
          </div>
          <Link href="/" className="inline-flex min-h-tap items-center gap-2 text-sm text-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> Storefront
          </Link>
        </header>
        <main id="main" className="grid flex-1 place-items-center px-gutter pb-16 pt-4">
          {children}
        </main>
      </div>
    </div>
  );
}
