import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Emporium · Where every click brings you closer to what you love", template: "%s · Emporium" },
  description: "Gadgets, furniture, accessories and clothes, curated in the Philippines. Free shipping over ₱2,500 and 30-day returns.",
  applicationName: "Emporium",
  icons: { icon: "/images/brand/logo.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the per-request nonce opts every route into dynamic rendering so Next can stamp it on scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en-PH" className="dark" suppressHydrationWarning>
      <body>
        <div className="starfield" aria-hidden />
        <a href="#main" className="sr-only z-[100] rounded-md bg-fg px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
