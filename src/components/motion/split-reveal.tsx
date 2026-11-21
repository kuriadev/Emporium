"use client";

import { animate, stagger } from "animejs";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * anime.js letter-stagger reveal (Figma "TEXT ANIMATION" frame). Text stays in the DOM for
 * screen readers via aria-label; per-letter spans are presentational. Skipped under reduced motion.
 */
export function SplitReveal({ text, className, as: Tag = "h1", delay = 0 }: { text: string; className?: string; as?: "h1" | "h2" | "p" | "span"; delay?: number }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters = el.querySelectorAll<HTMLElement>("[data-letter]");
    const anim = animate(letters, {
      opacity: [0, 1],
      translateY: ["0.6em", "0em"],
      rotateX: [-80, 0],
      filter: ["blur(0.5rem)", "blur(0rem)"],
      delay: stagger(45, { start: delay }),
      duration: 900,
      ease: "outExpo",
    });
    return () => {
      anim.revert();
    };
  }, [text, delay]);

  return (
    <Tag ref={ref as never} aria-label={text} className={cn("[perspective:40rem]", className)}>
      {Array.from(text).map((ch, i) => (
        <span key={i} data-letter aria-hidden className="inline-block will-change-transform" style={{ whiteSpace: ch === " " ? "pre" : undefined }}>
          {ch}
        </span>
      ))}
    </Tag>
  );
}
