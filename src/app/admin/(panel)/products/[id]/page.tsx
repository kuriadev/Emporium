import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductEditor, type ProductHistoryEntry } from "@/components/admin/product-editor";
import { PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/bits";
import type { ProductInput } from "@/lib/validations/admin";
import { requireAdminPage } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { getAdminProduct } from "@/server/services/admin";
import { listMediaLibrary } from "@/server/services/media";

type Props = { params: Promise<{ id: string }> };

const validId = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = validId(id) ? getAdminProduct(id) : null;
  return { title: data ? `Edit ${data.product.name}` : "Product not found" };
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdminPage("catalog:write", `/admin/products/${encodeURIComponent(id)}`);
  if (!validId(id)) notFound();
  const data = getAdminProduct(id);
  if (!data) notFound();
  const { product: p, variants, sales, history } = data;

  const defaults: ProductInput = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    category: p.category,
    tagline: p.tagline,
    description: p.description,
    basePrice: (p.basePrice / 100).toFixed(2),
    compareAtPrice: p.compareAtPrice ? (p.compareAtPrice / 100).toFixed(2) : "",
    status: p.status,
    featured: p.featured,
    tierPricing: p.tierPricing,
    materials: p.materials,
    dimensions: p.dimensions,
    images: p.images,
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      color: v.color ?? "",
      colorHex: v.colorHex ?? "",
      size: v.size ?? "",
      material: v.material ?? "",
      priceOverride: v.priceOverride === null ? "" : (v.priceOverride / 100).toFixed(2),
      stock: v.stock,
      reorderThreshold: v.reorderThreshold,
    })),
  };
  const entries: ProductHistoryEntry[] = history.map((h) => ({
    id: h.id,
    action: h.action,
    actor: h.actorEmail,
    at: h.createdAt.getTime(),
    changed: Object.keys(h.after ?? h.before ?? {}),
    reason: h.reason,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Catalog · Edit product"
        title={p.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={p.status === "active" ? "success" : p.status === "draft" ? "warning" : "neutral"}>{p.status}</Badge>
            <Link href="/admin/products" className="text-accent hover:underline">
              All products
            </Link>
            {p.status === "active" && (
              <Link href={`/products/${p.slug}`} target="_blank" className="text-accent hover:underline">
                View on storefront ↗
              </Link>
            )}
          </span>
        }
      />
      <ProductEditor defaults={defaults} isNew={false} canDelete={can(admin.adminRole, "catalog:delete")} library={await listMediaLibrary()} sales={sales} history={entries} />
    </>
  );
}
