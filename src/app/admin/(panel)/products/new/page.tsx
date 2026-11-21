import type { Metadata } from "next";
import Link from "next/link";
import { ProductEditor } from "@/components/admin/product-editor";
import { PRODUCT_PRESETS } from "@/components/admin/product-presets";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminPage } from "@/server/auth/guards";
import { listMediaLibrary } from "@/server/services/media";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdminPage("catalog:write", "/admin/products/new");
  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="New product"
        description={
          <>
            Starts as a draft, so nothing goes live until you activate it.{" "}
            <Link href="/admin/products" className="text-accent hover:underline">
              Back to products
            </Link>
          </>
        }
      />
      <ProductEditor defaults={PRODUCT_PRESETS[0]!.values} isNew canDelete={false} library={await listMediaLibrary()} presets={PRODUCT_PRESETS} />
    </>
  );
}
