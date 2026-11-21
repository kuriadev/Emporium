"use client";

import { DotLottieReact, setWasmUrl } from "@lottiefiles/dotlottie-react";
import { useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Self-hosted WASM: keeps CSP at connect-src 'self' (no third-party CDN).
setWasmUrl("/lottie/dotlottie-player.wasm");

export function LottieSuccess({ className, label = "Success" }: { className?: string; label?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <CheckCircle2 role="img" aria-label={label} className={cn("size-24 text-success", className)} />;
  return (
    <div role="img" aria-label={label} className={cn("size-28", className)}>
      <DotLottieReact src="/lottie/success.json" autoplay loop={false} renderConfig={{ autoResize: true }} />
    </div>
  );
}
