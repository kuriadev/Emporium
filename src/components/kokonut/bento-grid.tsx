import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BentoItem {
  title: string;
  blurb: string;
  href: string;
  image: string;
  imageAlt: string;
  meta?: string;
  className?: string;
  imageClassName?: string;
  tone?: "dark" | "light";
}

/**
 * Asymmetric bento grid in the Kokonut UI style: one feature tile spanning two rows, mixed
 * light/dark tiles, hover lift and an arrow affordance. Collapses to a single column on phones.
 */
export function BentoGrid({ items }: { items: BentoItem[] }) {
  return (
    <ul className="grid auto-rows-[minmax(14rem,auto)] grid-cols-1 gap-4 md:grid-cols-4 md:auto-rows-[15rem]">
      {items.map((it) => (
        <li key={it.title} className={cn("group relative overflow-hidden rounded-xl ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:ring-line-strong", it.tone === "light" ? "bg-white text-bg" : "bg-surface", it.className)}>
          <Link href={it.href} className="absolute inset-0 z-10" aria-label={`${it.title}: ${it.blurb}`} />
          <Image src={it.image} alt={it.imageAlt} fill sizes="(min-width: 48rem) 50vw, 100vw" className={cn("object-cover transition-transform duration-700 group-hover:scale-105", it.imageClassName)} />
          <div className={cn("absolute inset-0", it.tone === "light" ? "bg-gradient-to-t from-white via-white/30 to-transparent" : "bg-gradient-to-t from-black/90 via-black/30 to-transparent")} aria-hidden />
          <div className="relative flex h-full flex-col justify-end gap-1 p-6">
            {it.meta && <span className={cn("text-2xs uppercase tracking-[0.25em]", it.tone === "light" ? "text-black/60" : "text-subtle")}>{it.meta}</span>}
            <span className="flex items-center justify-between gap-3 text-2xl font-medium">
              {it.title}
              <ArrowUpRight className="size-6 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden />
            </span>
            <span className={cn("max-w-[24rem] text-sm", it.tone === "light" ? "text-black/70" : "text-muted")}>{it.blurb}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
