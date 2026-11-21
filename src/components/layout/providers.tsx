"use client";

import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <MotionConfig reducedMotion="user" nonce={nonce}>
      {children}
      <Toaster
        position="bottom-center"
        expand={false}
        visibleToasts={4}
        closeButton
        theme="dark"
        offset="5.5rem"
        mobileOffset="5.5rem"
        toastOptions={{
          classNames: {
            toast: "!rounded-md !border !border-line !bg-surface-2/95 !text-fg !backdrop-blur-xl !font-sans",
            description: "!text-muted",
            actionButton: "!bg-fg !text-bg !rounded-pill",
          },
        }}
      />
    </MotionConfig>
  );
}
