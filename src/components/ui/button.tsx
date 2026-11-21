"use client";

import type { VariantProps } from "class-variance-authority";
import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button-variants";

export { buttonVariants };

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children">, VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
  loading?: boolean;
  success?: boolean;
}

/** Tactile button: press compression, springy release, and a success "surge" state. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, success, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.94, y: 1 }}
      animate={success ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={success ? { duration: 0.35, ease: "easeOut" } : { type: "spring", stiffness: 600, damping: 22, mass: 0.6 }}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {loading ? (
          <motion.span key="l" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-2">
            <Loader2 className="size-[1.1em] animate-spin" aria-hidden />
            <span>Working…</span>
          </motion.span>
        ) : success ? (
          <motion.span key="s" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 700, damping: 18 }} className="inline-flex items-center gap-2">
            <Check className="size-[1.1em]" aria-hidden />
            <span>Done</span>
          </motion.span>
        ) : (
          <motion.span key="c" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-2">
            {children}
          </motion.span>
        )}
      </AnimatePresence>
      {success && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-[0.25rem] ring-success"
          initial={{ opacity: 0.9, scale: 1 }}
          animate={{ opacity: 0, scale: 1.25 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.button>
  );
});
