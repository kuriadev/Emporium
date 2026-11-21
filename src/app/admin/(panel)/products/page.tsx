import { Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CsvImport } from "@/components/admin/csv-import";
import { ProductsTable, type AdminProductRow } from "@/components/admin/products-table";
import { FilterLinks, PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button-variants";
import { sanitizeText } from "@/lib/security/sanitize";
import { requireAdminPage } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { listAdminProducts } from "@/server/services/admin";

export const metadata: Metadata = { title: "Products" };

type Props = { searchParams: Promise<{ q?: string; status?: string; stock?: string }> };
const STATUSES = ["active", "draft", "archived"] as const;

export default async function AdminProductsPage({ searchParams }: Props) {
  const admin = await requireAdminPage("catalog:write", "/admin/products");
  const sp = await searchParams;
  const q = sanitizeText(typeof sp.q === "string" ? sp.q : "").slice(0, 60);
  const status = STATUSES.find((s) => s === sp.status) ?? "";
  const lowOnly = sp.stock === "low";

  const all = listAdminProducts(q, "");
  const products = all.filter((p) => (!status || p.status === status) && (!lowOnly || p.lowStock));
  const rows: AdminProductRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    slug: p.slug,
    category: p.category,
    status: p.status,
    price: p.basePrice,
    compareAtPrice: p.compareAtPrice,
    image: p.images[0]?.src ?? null,
    totalStock: p.totalStock,
    lowCount: p.variants.filter((v) => v.stock <= v.reorderThreshold).length,
    variantCount: p.variants.length,
    updatedAt: p.updatedAt.getTime(),
  }));

  const href = (patch: Record<string, string>) => {
    const params = new URLSearchParams({ ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...params]) if (!v) params.delete(k);
    const s = params.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Edit details, variants and stock. Every change is written to the audit log."
        actions={
          <>
            <a href="/api/admin/export/products" download className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download className="size-4" aria-hidden /> Export CSV
            </a>
            <CsvImport />
            <Link href="/admin/products/new" className={buttonVariants({ size: "sm" })}>
              <Plus className="size-4" aria-hidden /> New product
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterLinks
          label="Filter products"
          options={[
            { href: href({}), label: "All", active: !status && !lowOnly, count: all.length },
            ...STATUSES.map((s) => ({ href: href({ status: s }), label: s[0]!.toUpperCase() + s.slice(1), active: status === s && !lowOnly, count: all.filter((p) => p.status === s).length })),
            { href: href({ stock: "low" }), label: "Needs restock", active: lowOnly, count: all.filter((p) => p.lowStock).length },
          ]}
        />
        <form role="search" action="/admin/products" className="flex w-full gap-2 lg:w-auto">
          {status && <input type="hidden" name="status" value={status} />}
          {lowOnly && <input type="hidden" name="stock" value="low" />}
          <label htmlFor="product-q" className="sr-only">
            Search products
          </label>
          <input
            id="product-q"
            name="q"
            defaultValue={q}
            maxLength={60}
            placeholder="Name, brand or SKU"
            className="min-h-tap w-full rounded-pill border border-line bg-surface/70 px-4 text-sm outline-none transition focus:border-accent focus:shadow-[0_0_0_0.25rem_oklch(0.78_0.11_315/0.25)] lg:w-[18rem]"
          />
          <button type="submit" className={buttonVariants({ variant: "outline", size: "sm", className: "min-h-tap" })}>
            Search
          </button>
        </form>
      </div>

      <ProductsTable rows={rows} canDelete={can(admin.adminRole, "catalog:delete")} query={q} />
    </>
  );
}
