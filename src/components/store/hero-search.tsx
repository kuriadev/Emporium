"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/stores/cart";

const PROMPTS = ["AirPods", "a blue jacket", "Vision Pro", "a minimalist watch", "an iPhone case"];

/** Hero search pill: opens the predictive search overlay; the placeholder cycles through real catalogue terms. */
export function HeroSearch() {
  const setPanel = useCart((s) => s.setPanel);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % PROMPTS.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.button
      type="button"
      onClick={() => setPanel("search")}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      className="glass flex min-h-[3.5rem] w-full max-w-[34rem] items-center gap-3 rounded-pill px-5 text-left text-muted transition-colors hover:text-fg"
      aria-label="Search the store"
      aria-keyshortcuts="Control+K Meta+K"
    >
      <Search className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        Search for{" "}
        <motion.span key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="inline-block text-fg">
          {PROMPTS[i]}
        </motion.span>
      </span>
      <kbd className="hidden rounded-xs border border-line px-2 py-0.5 text-2xs text-subtle sm:inline">⌘K</kbd>
    </motion.button>
  );
}
