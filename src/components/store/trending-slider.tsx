"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface TrendingSlide {
  src: string;
  alt: string;
  href: string;
  label: string;
}

const INTERVAL_MS = 4500;

/**
 * Figma "Automatic Slide" + "Play And Pause": auto-advancing promo tiles with a visible pause
 * control (WCAG 2.2.2), swipe support, and no autoplay under prefers-reduced-motion.
 */
export function TrendingSlider({ slides }: { slides: TrendingSlide[] }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const count = slides.length;
  const go = useCallback((d: number) => setIndex((i) => (i + d + count) % count), [count]);

  useEffect(() => {
    if (!playing || hovering || reduce || count < 2) return;
    const t = setInterval(() => go(1), INTERVAL_MS);
    return () => clearInterval(t);
  }, [playing, hovering, reduce, go, count]);

  const visible = [0, 1, 2, 3].map((o) => slides[(index + o) % count]!);

  return (
    <div className="relative" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} onFocus={() => setHovering(true)} onBlur={() => setHovering(false)}>
      <div className="sr-only" aria-live={playing ? "off" : "polite"}>
        Slide {index + 1} of {count}: {slides[index]?.label}
      </div>
      <motion.ul
        className="grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-4"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60) go(1);
          else if (info.offset.x > 60) go(-1);
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((s, i) => (
            <motion.li
              key={`${s.src}-${(index + i) % count}`}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className={cn(i >= 1 && "hidden xs:block", i >= 2 && "xs:hidden lg:block")}
            >
              <Link href={s.href} className="group block overflow-hidden rounded-xl ring-1 ring-line transition hover:ring-line-strong" aria-label={s.label}>
                <Image src={s.src} alt={s.alt} width={422} height={455} sizes="(min-width: 64rem) 25vw, (min-width: 23.4375rem) 50vw, 100vw" className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]" />
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex gap-1.5" role="tablist" aria-label="Choose slide">
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to ${s.label}`}
              onClick={() => setIndex(i)}
              className="grid h-tap place-items-center px-1"
            >
              <span className={cn("block h-1 rounded-pill transition-all duration-300", i === index ? "w-8 bg-fg" : "w-3 bg-white/25")} />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <IconBtn label="Previous slide" onClick={() => go(-1)}>
            <ChevronLeft className="size-5" />
          </IconBtn>
          <IconBtn label={playing ? "Pause slideshow" : "Play slideshow"} onClick={() => setPlaying((p) => !p)} pressed={!playing}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </IconBtn>
          <IconBtn label="Next slide" onClick={() => go(1)}>
            <ChevronRight className="size-5" />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.88 }} type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className="grid size-tap place-items-center rounded-full border border-line text-muted transition hover:border-fg hover:text-fg">
      {children}
    </motion.button>
  );
}
