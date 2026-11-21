import { cva } from "class-variance-authority";

/** Shared by the client <Button> and by server components that style links as buttons. */
export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-pill font-normal tracking-wide transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[0.1875rem] focus-visible:ring-accent focus-visible:ring-offset-[0.125rem] focus-visible:ring-offset-bg",
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg hover:bg-white shadow-[0_0.75rem_2rem_-0.75rem_oklch(1_0_0/0.45)]",
        outline: "border border-line-strong bg-transparent text-fg hover:border-fg hover:bg-white/5",
        blob: "blob-card text-fg hover:brightness-125",
        ghost: "bg-transparent text-muted hover:bg-white/5 hover:text-fg",
        accent: "bg-accent text-bg hover:bg-accent-strong",
        danger: "border border-danger/60 bg-danger/10 text-danger hover:bg-danger/20",
      },
      size: {
        // Compact for mouse users; touch screens always get the full 2.75rem target.
        sm: "min-h-[2.25rem] px-4 text-sm pointer-coarse:min-h-tap",
        md: "min-h-tap px-6 text-base",
        lg: "min-h-[3.5rem] px-8 text-lg",
        icon: "size-tap shrink-0 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
