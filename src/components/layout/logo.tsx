import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/", label = "Emporium home" }: { className?: string; href?: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className={cn("inline-flex shrink-0 items-center", className)}>
      <Image src="/images/brand/logo.png" alt="" width={96} height={92} priority className="h-[2.75rem] w-auto" />
    </Link>
  );
}
