"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}

const backdrop = (
  <D.Overlay asChild forceMount>
    <motion.div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
  </D.Overlay>
);

function Header({ title, description, hideTitle }: Pick<OverlayProps, "title" | "description" | "hideTitle">) {
  return (
    <div className={cn("flex items-start justify-between gap-4", hideTitle && "sr-only")}>
      <div>
        <D.Title className="text-xl font-normal">{title}</D.Title>
        {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : null}
      </div>
    </div>
  );
}

const closeBtn = (
  <D.Close className="absolute right-3 top-3 grid size-tap place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-fg" aria-label="Close">
    <X className="size-5" />
  </D.Close>
);

/** Centered modal with focus trap, Escape to dismiss and scroll lock (Radix). */
export function Modal({ open, onOpenChange, title, description, children, className, hideTitle, placement = "center" }: OverlayProps & { placement?: "center" | "top" }) {
  const top = placement === "top";
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            {backdrop}
            <D.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                className={cn(
                  "glass fixed left-1/2 z-[61] w-[min(calc(100vw-2rem),56rem)] overflow-y-auto rounded-lg p-6 sm:p-8",
                  top ? "top-[6dvh] max-h-[88dvh]" : "top-1/2 max-h-[calc(100dvh-2rem)]",
                  className,
                )}
                initial={{ opacity: 0, scale: 0.94, x: "-50%", y: top ? "-1rem" : "-46%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: top ? "0rem" : "-50%" }}
                exit={{ opacity: 0, scale: 0.96, x: "-50%", y: top ? "-0.5rem" : "-48%" }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              >
                <Header title={title} description={description} hideTitle={hideTitle} />
                {closeBtn}
                {children}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

/** Slide-over drawer with spring physics and drag-to-dismiss (swipe friendly). */
export function Sheet({ open, onOpenChange, title, description, children, className, side = "right" }: OverlayProps & { side?: "right" | "bottom" }) {
  const isRight = side === "right";
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            {backdrop}
            <D.Content asChild forceMount>
              <motion.div
                className={cn(
                  "glass fixed z-[61] flex flex-col",
                  isRight ? "inset-y-0 right-0 w-full max-w-[28rem] rounded-l-xl" : "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl",
                  className,
                )}
                initial={isRight ? { x: "100%" } : { y: "100%" }}
                animate={isRight ? { x: 0 } : { y: 0 }}
                exit={isRight ? { x: "100%" } : { y: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
                drag={isRight ? "x" : "y"}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={{ left: 0, right: 0.6, top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => {
                  if ((isRight ? info.offset.x : info.offset.y) > 120 || (isRight ? info.velocity.x : info.velocity.y) > 600) onOpenChange(false);
                }}
              >
                <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
                  <div>
                    <D.Title className="text-xl font-normal">{title}</D.Title>
                    {description ? <D.Description className="text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
                  </div>
                  <D.Close className="grid size-tap place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-fg" aria-label="Close">
                    <X className="size-5" />
                  </D.Close>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">{children}</div>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
